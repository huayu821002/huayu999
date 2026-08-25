'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/components/ui/Icons'
import { adminFetch } from '@/lib/adminFetch'

interface Banner {
  id: string
  image: string
  link: string
  alt: string
  duration: number
  title: string
  subtitle: string
  buttonText: string
  buttonLink: string
}

export default function AdminBanners() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [banners, setBanners] = useState<Banner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    
    if (!token || !userStr) {
      router.push('/login')
      return
    }
    
    try {
      const user = JSON.parse(userStr)
      if (user.role !== 'ADMIN') {
        router.push('/login')
        return
      }
      setIsAdmin(true)
    } catch {
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    if (!isAdmin) return
    fetchBanners()
  }, [isAdmin])

  const fetchBanners = async () => {
    try {
      // Fetch banners from settings API
      const res = await adminFetch('/api/admin/settings?key=homepage_banners')
      const data = await res.json()
      if (data.success && data.data) {
        const bannerSetting = data.data.find((s: any) => s.key === 'homepage_banners')
        if (bannerSetting && bannerSetting.value) {
          const parsed = JSON.parse(bannerSetting.value)
          setBanners(parsed.length > 0 ? parsed : [createEmptyBanner()])
        } else {
          setBanners([createEmptyBanner()])
        }
      }
    } catch (err) {
      console.error('Failed to fetch banners:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const createEmptyBanner = (): Banner => ({
    id: Date.now().toString(),
    image: '',
    link: '',
    alt: '',
    duration: 5000,
    title: '',
    subtitle: '',
    buttonText: '',
    buttonLink: ''
  })

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        const newBanners = [...banners]
        newBanners[index].image = data.url
        setBanners(newBanners)
      } else {
        alert('Upload failed: ' + data.error)
      }
    } catch (err) {
      console.error('Upload error:', err)
      alert('Upload failed')
    }
  }

  const updateBanner = (index: number, field: keyof Banner, value: string | number) => {
    const newBanners = [...banners]
    ;(newBanners[index] as Banner)[field] = value as never
    setBanners(newBanners)
  }

  const addBanner = () => {
    if (banners.length >= 5) {
      alert('最多5张轮播图')
      return
    }
    setBanners([...banners, createEmptyBanner()])
  }

  const removeBanner = (index: number) => {
    if (banners.length <= 1) {
      alert('至少保留1张轮播图')
      return
    }
    setBanners(banners.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const validBanners = banners.filter(b => b.image)
      // Use the existing settings API to save banners
      const res = await adminFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'homepage_banners', value: JSON.stringify(validBanners) })
      })
      const data = await res.json()
      if (data.success) {
        alert('保存成功！')
        setBanners(validBanners.length > 0 ? validBanners : [createEmptyBanner()])
      } else {
        alert('保存失败: ' + (data.error || '未知错误'))
      }
    } catch (err) {
      console.error('Save error:', err)
      alert('保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-joy-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-joy-orange border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-joy-gray-50">
      <Header />
      <main className="pt-[calc(4rem+36px)]">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold text-joy-gray-900">首页轮播图管理</h1>
            <p className="text-joy-gray-600 mt-1">设置首页通栏轮播广告，最多5张图片，支持文字叠加</p>
          </div>

          <div className="space-y-6">
            {banners.map((banner, index) => (
              <div key={banner.id} className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-joy-gray-900">轮播图 {index + 1}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBanner(index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Icons.X size={16} className="mr-1" />
                    删除
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Image Upload */}
                  <div>
                    <label className="block text-sm font-medium text-joy-gray-700 mb-2">背景图片 *</label>
                    <div className="border-2 border-dashed border-joy-gray-200 rounded-xl p-4 text-center">
                      {banner.image ? (
                        <div className="relative">
                          <img src={banner.image} alt={banner.alt} className="max-h-48 mx-auto rounded-lg" />
                          <label className="mt-3 inline-block cursor-pointer text-sm text-joy-orange hover:text-joy-orange/80">
                            更换图片
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, index)} />
                          </label>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <Icons.Image size={40} className="mx-auto text-joy-gray-300 mb-2" />
                          <p className="text-sm text-joy-gray-500">点击上传图片</p>
                          <p className="text-xs text-joy-gray-400 mt-1">JPG, PNG, GIF, WEBP (最大5MB)</p>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, index)} />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Text Settings */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1">标题文字</label>
                      <input
                        type="text"
                        value={banner.title}
                        onChange={(e) => updateBanner(index, 'title', e.target.value)}
                        placeholder="例如：Wholesale Products"
                        className="w-full px-3 py-2 border border-joy-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-joy-orange/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1">副标题文字</label>
                      <input
                        type="text"
                        value={banner.subtitle}
                        onChange={(e) => updateBanner(index, 'subtitle', e.target.value)}
                        placeholder="例如：Direct from Factory - No middlemen"
                        className="w-full px-3 py-2 border border-joy-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-joy-orange/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1">按钮文字</label>
                      <input
                        type="text"
                        value={banner.buttonText}
                        onChange={(e) => updateBanner(index, 'buttonText', e.target.value)}
                        placeholder="例如：Shop Now"
                        className="w-full px-3 py-2 border border-joy-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-joy-orange/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-joy-gray-700 mb-1">按钮跳转链接</label>
                      <input
                        type="text"
                        value={banner.buttonLink}
                        onChange={(e) => updateBanner(index, 'buttonLink', e.target.value)}
                        placeholder="/products"
                        className="w-full px-3 py-2 border border-joy-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-joy-orange/50"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-joy-gray-700 mb-1">轮播时长 (毫秒)</label>
                        <input
                          type="number"
                          value={banner.duration}
                          onChange={(e) => updateBanner(index, 'duration', parseInt(e.target.value) || 5000)}
                          min={1000}
                          max={10000}
                          step={500}
                          className="w-full px-3 py-2 border border-joy-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-joy-orange/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-joy-gray-700 mb-1">图片描述 (alt)</label>
                        <input
                          type="text"
                          value={banner.alt}
                          onChange={(e) => updateBanner(index, 'alt', e.target.value)}
                          placeholder="轮播图描述"
                          className="w-full px-3 py-2 border border-joy-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-joy-orange/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {banners.length < 5 && (
              <Button variant="outline" onClick={addBanner} className="w-full py-6 border-2 border-dashed">
                <Icons.Plus size={20} className="mr-2" />
                添加轮播图
              </Button>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={isSaving} className="min-w-32">
                {isSaving ? (
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  '保存设置'
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
