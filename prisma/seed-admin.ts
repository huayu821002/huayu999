import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  // ★ 2026-10-30 安全修复：不再硬编码弱口令 `admin123`（该口令在生产实测可用）。
  //   密码改为从环境变量读取；未配置时随机生成一个强密码并打印一次。
  //   为什么不留默认值：任何写进代码的默认值最终都会泄漏到 git 历史 / 被复用。
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@fiestaflare.com'
  const envPassword = process.env.SEED_ADMIN_PASSWORD
  const generated = !envPassword
  const password = envPassword || randomBytes(12).toString('base64url')

  // 密码强度校验（与注册/改密接口保持一致）
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters and contain both letters and numbers')
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  // Check if admin exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email },
  })

  if (existingAdmin) {
    console.log('Admin user already exists')
    // Update password to ensure it's correct
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword, role: 'ADMIN' },
    })
    console.log('Admin password updated')
  } else {
    // Create admin user
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Admin',
        role: 'ADMIN',
      },
    })
    console.log('Admin user created')
  }

  if (generated) {
    // 随机密码只打印这一次，请立即保存并妥善保管
    console.log('==============================================')
    console.log(`管理员账号: ${email}`)
    console.log(`管理员密码（仅显示一次，请立即保存）: ${password}`)
    console.log('==============================================')
  } else {
    console.log(`Admin user ready: ${email}（密码来自 SEED_ADMIN_PASSWORD）`)
  }

  // Also create test customer if not exists
  const customerEmail = 'customer@test.com'
  const existingCustomer = await prisma.user.findUnique({
    where: { email: customerEmail },
  })

  if (!existingCustomer) {
    // 测试客户同样不写死弱口令：未配置时随机生成
    const customerPassword = process.env.SEED_TEST_CUSTOMER_PASSWORD || randomBytes(12).toString('base64url')
    const hashedCustomerPassword = await bcrypt.hash(customerPassword, 10)
    await prisma.user.create({
      data: {
        email: customerEmail,
        password: hashedCustomerPassword,
        name: 'Test Customer',
        role: 'CUSTOMER',
      },
    })
    console.log('Test customer created')
    console.log(`测试客户账号: ${customerEmail} / ${customerPassword}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
