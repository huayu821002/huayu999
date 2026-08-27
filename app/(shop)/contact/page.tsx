import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer } from '@/components/shop/CartDrawer'
import { FloatingButtons } from '@/components/shop/FloatingButtons'
import { Icons } from '@/components/ui/Icons'
import Link from 'next/link'

export const metadata = { title: 'Contact Us - Fiestaflare' }

export default function ContactPage() {
  return (
    <>
      <CartDrawer />
      <FloatingButtons />
      <main className="pt-[calc(4rem+36px)]">
        {/* Hero */}
        <section className="bg-gradient-to-br from-orange-600 via-orange-500 to-orange-600 text-white py-16 lg:py-20">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>
        </section>

        {/* Breadcrumb */}
        <div className="max-w-4xl mx-auto px-4 py-4">
          <nav className="flex items-center gap-2 text-sm text-joy-gray-500">
            <Link href="/" className="hover:text-joy-orange">Home</Link>
            <Icons.ChevronRight size={14} />
            <span className="text-joy-gray-900">Contact Us</span>
          </nav>
        </div>

        {/* Main Content */}
        <section className="max-w-4xl mx-auto px-4 pb-16">
          <div className="grid lg:grid-cols-3 gap-10">

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-joy-gray-200 p-6 lg:p-8 shadow-sm">
                <h2 className="text-xl font-bold text-joy-gray-900 mb-6">Send us a message</h2>
                <form id="contact-form" className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">
                      Contact Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="Your full name"
                      className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">
                        Email <span className="text-joy-orange">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        required
                        placeholder="you@example.com"
                        className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">
                        Phone
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        placeholder="+1 234 567 8900"
                        className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">
                      Subject
                    </label>
                    <input
                      type="text"
                      name="subject"
                      placeholder="What is this about?"
                      className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-1.5">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="message"
                      required
                      rows={5}
                      placeholder="Tell us what you need..."
                      className="w-full px-4 py-3 rounded-xl border-2 border-joy-gray-200 focus:border-joy-orange focus:outline-none transition-colors resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-joy-orange text-white font-semibold py-3.5 rounded-xl hover:bg-orange-600 transition-colors text-lg"
                  >
                    Send Message
                  </button>
                </form>
                <p id="form-message" className="mt-4 text-center text-sm hidden" />
              </div>
            </div>

            {/* Contact Info */}
            <div>
              <div className="bg-gradient-to-br from-orange-50 to-white rounded-2xl border border-orange-100 p-6 space-y-6">
                <div>
                  <h3 className="font-bold text-joy-gray-900 mb-3">Get in Touch</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span style={{ fontSize: '1.2rem' }}>📧</span>
                      <div>
                        <p className="text-sm font-medium text-joy-gray-700">Email</p>
                        <a href="mailto:support@fiestaflare.com" className="text-sm text-joy-orange hover:underline">support@fiestaflare.com</a>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span style={{ fontSize: '1.2rem' }}>💬</span>
                      <div>
                        <p className="text-sm font-medium text-joy-gray-700">WhatsApp</p>
                        <p className="text-sm text-joy-gray-600">Available for business inquiries</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span style={{ fontSize: '1.2rem' }}>📍</span>
                      <div>
                        <p className="text-sm font-medium text-joy-gray-700">Location</p>
                        <p className="text-sm text-joy-gray-600">Yiwu, Zhejiang, China</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span style={{ fontSize: '1.2rem' }}>🕐</span>
                      <div>
                        <p className="text-sm font-medium text-joy-gray-700">Response Time</p>
                        <p className="text-sm text-joy-gray-600">Within 24 hours</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-orange-100 pt-5">
                  <p className="text-sm font-medium text-joy-gray-700 mb-2">We speak:</p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-medium">English</span>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-medium">Português</span>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-medium">Русский</span>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-medium">中文</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('contact-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          var btn = this.querySelector('button[type=submit]');
          var msg = document.getElementById('form-message');
          btn.disabled = true;
          btn.textContent = 'Sending...';
          var formData = new FormData(this);
          var data = Object.fromEntries(formData.entries());
          try {
            var res = await fetch('/api/contact', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
            var json = await res.json();
            if (res.ok) {
              msg.textContent = '✅ Message sent successfully! We will get back to you within 24 hours.';
              msg.className = 'mt-4 text-center text-sm text-green-600';
              msg.classList.remove('hidden');
              this.reset();
            } else {
              msg.textContent = '❌ ' + (json.error || 'Failed to send. Please try again.');
              msg.className = 'mt-4 text-center text-sm text-red-600';
              msg.classList.remove('hidden');
            }
          } catch(err) {
            msg.textContent = '❌ Network error. Please try again.';
            msg.className = 'mt-4 text-center text-sm text-red-600';
            msg.classList.remove('hidden');
          }
          btn.disabled = false;
          btn.textContent = 'Send Message';
        });
      ` }} />
    </>
  )
}
