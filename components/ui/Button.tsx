import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'south' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  isLoading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
    
    const variants = {
      primary: 'bg-gradient-to-r from-joy-orange to-joy-pink text-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:ring-joy-orange',
      secondary: 'bg-white text-joy-gray-800 border-2 border-joy-gray-200 hover:border-joy-orange hover:text-joy-orange focus:ring-joy-orange',
      ghost: 'text-joy-gray-600 hover:text-joy-orange hover:bg-joy-gray-50 focus:ring-joy-orange',
      south: 'bg-gradient-to-r from-joy-orange via-joy-pink to-joy-green text-white font-bold py-4 px-8 rounded-full shadow-lg hover:shadow-xl animate-pulse-glow focus:ring-joy-pink',
      outline: 'border-2 border-joy-orange text-joy-orange hover:bg-joy-orange hover:text-white focus:ring-joy-orange',
    }

    const sizes = {
      sm: 'text-sm py-2 px-4',
      md: 'text-base py-3 px-6',
      lg: 'text-lg py-4 px-8',
      xl: 'text-xl py-5 px-10',
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : null}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
