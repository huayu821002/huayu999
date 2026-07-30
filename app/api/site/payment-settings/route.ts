import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET public payment settings (for storefront)
export async function GET() {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'payment_settings' }
    })
    
    let settings = getDefaultPublicSettings()
    
    if (setting?.value) {
      settings = JSON.parse(setting.value)
    }
    
    // Return only public info (not secrets)
    const normalizedPaypal = normalizePaypalSettings(settings.paypal, settings.mode)
    const publicSettings = {
      mode: settings.mode,
      paypal: {
        enabled: normalizedPaypal.enabled,
        mode: normalizedPaypal.mode,
        clientId: settings.mode === 'sandbox'
          ? normalizedPaypal.sandbox.clientId
          : normalizedPaypal.production.clientId,
      },
      stripe: {
        enabled: (settings as any).stripe?.enabled ?? true,
        publishableKey: settings.mode === 'sandbox'
          ? (settings as any).stripe?.sandbox?.publishableKey || (settings as any).stripe?.publishableKey || ''
          : (settings as any).stripe?.production?.publishableKey || '',
      },
      bankTransfer: {
        enabled: settings.bankTransfer?.enabled ?? true,
        bankName: settings.bankTransfer?.bankName,
        accountName: settings.bankTransfer?.accountName,
        // Mask account number for security
        accountNumber: maskAccountNumber(settings.bankTransfer?.accountNumber),
        swiftCode: settings.bankTransfer?.swiftCode,
        instructions: settings.bankTransfer?.instructions,
      },
      cod: {
        enabled: settings.cod?.enabled ?? false,
        fee: settings.cod?.fee ?? 0,
      }
    }
    
    return NextResponse.json({ success: true, data: publicSettings })
  } catch (error) {
    return NextResponse.json({ success: true, data: getDefaultPublicSettings() })
  }
}

function maskAccountNumber(accountNumber: string | undefined): string {
  if (!accountNumber) return '****'
  const parts = accountNumber.split(' ')
  if (parts.length >= 4) {
    return `${parts[0]} ${parts[1]} ${parts[2]} ****`
  }
  return '****'
}

function getDefaultPublicSettings() {
  return {
    mode: 'sandbox',
    paypal: {
      enabled: true,
      mode: 'sandbox',
      sandbox: { clientId: '' },
      production: { clientId: '' }
    },
    stripe: { enabled: true, publishableKey: '' },
    bankTransfer: {
      enabled: true,
      bankName: 'Bank of America',
      accountName: 'Fiestaflare Inc.',
      accountNumber: '****',
      swiftCode: 'BOFAUS3N',
      instructions: 'Please include your order number in the payment reference.',
    },
    cod: { enabled: false, fee: 0 },
  }
}

// Ensure nested paypal structure exists
function normalizePaypalSettings(paypal: any, mode: string): any {
  if (!paypal) return getDefaultPublicSettings().paypal
  return {
    enabled: paypal.enabled ?? true,
    mode: mode,
    sandbox: {
      clientId: paypal.sandbox?.clientId || paypal.clientId || ''
    },
    production: {
      clientId: paypal.production?.clientId || ''
    }
  }
}
