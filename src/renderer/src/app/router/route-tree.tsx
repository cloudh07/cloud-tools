import type { AppRouterContext } from '@/app/router-context'
import type { RouteBreadcrumbStatic } from '@/app/router/route-breadcrumb-static'
import { SettingsPage } from '@/features/settings/presentation/pages/SettingsPage'
import type { ToolsRouteContextSlice } from '@/features/tools/domain/tools-route-context'
import { ToolsLayout } from '@/features/tools/presentation/layout/ToolsLayout'
import type { AudioExtractRouteContextSlice } from '@/features/audio-extract/domain/audio-extract-route-context'
import { AudioExtractorPage } from '@/features/audio-extract/presentation/pages/AudioExtractorPage'
import { parseImageSmartCropSearch } from '@/features/image-smart-crop/application/image-smart-crop-search.schema'
import type { ImageFormatConvertRouteContextSlice } from '@/features/image-format-convert/domain/image-format-convert-route-context'
import { parseImageFormatConvertSearch } from '@/features/image-format-convert/application/image-format-convert-search.schema'
import { ImageFormatConvertPage } from '@/features/image-format-convert/presentation/pages/ImageFormatConvertPage'
import { ImageDocumentMergePage } from '@/features/image-document-merge/presentation/pages/ImageDocumentMergePage'
import type { ImageWatermarkRouteContextSlice } from '@/features/image-watermark/domain/image-watermark-route-context'
import { ImageWatermarkPage } from '@/features/image-watermark/presentation/pages/ImageWatermarkPage'
import type { WatermarkRemoveRouteContextSlice } from '@/features/watermark-remove/domain/watermark-remove-route-context'
import { WatermarkRemovePage } from '@/features/watermark-remove/presentation/pages/WatermarkRemovePage'
import type { ImageSmartCropRouteContextSlice } from '@/features/image-smart-crop/domain/image-smart-crop-route-context'
import { ImageSmartCropPage } from '@/features/image-smart-crop/presentation/pages/ImageSmartCropPage'
import type { VideoCompressRouteContextSlice } from '@/features/video-compress/domain/video-compress-route-context'
import { VideoCompressPage } from '@/features/video-compress/presentation/pages/VideoCompressPage'
import type { ChromaVideoRouteContextSlice } from '@/features/video-chroma/domain/chroma-video-route-context'
import { parseChromaVideoSearch } from '@/features/video-chroma/application/chroma-video-search.schema'
import { VideoChromaPage } from '@/features/video-chroma/presentation/pages/VideoChromaPage'
import { AppShell } from '@/presentation/layout/AppShell'
import { AppNotFoundPage } from '@/presentation/pages/AppNotFoundPage'
import { getDesktop } from '@/shared/lib/desktop-bridge'
import { createRootRouteWithContext, createRoute, redirect } from '@tanstack/react-router'

const rootRoute = createRootRouteWithContext<AppRouterContext>()({
  component: AppShell,
  notFoundComponent: AppNotFoundPage
})

const rootIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/tools/chroma-video', replace: true })
  }
})

const toolsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'tools',
  staticData: {
    breadcrumb: 'Công cụ',
    breadcrumbAsLink: false
  } satisfies RouteBreadcrumbStatic,
  context: (): ToolsRouteContextSlice => ({
    desktop: getDesktop()
  }),
  component: ToolsLayout
})

const chromaVideoRoute = createRoute({
  getParentRoute: () => toolsRoute,
  path: 'chroma-video',
  staticData: { breadcrumb: 'Chroma video' } satisfies RouteBreadcrumbStatic,
  context: (): ChromaVideoRouteContextSlice => ({
    chromaVideo: {
      slug: 'chroma-video',
      title: 'Chroma video'
    }
  }),
  component: VideoChromaPage,
  validateSearch: parseChromaVideoSearch
})

const videoCompressRoute = createRoute({
  getParentRoute: () => toolsRoute,
  path: 'video-compress',
  staticData: { breadcrumb: 'Tối ưu video' } satisfies RouteBreadcrumbStatic,
  context: (): VideoCompressRouteContextSlice => ({
    videoCompress: {
      slug: 'video-compress',
      title: 'Tối ưu video'
    }
  }),
  component: VideoCompressPage
})

const audioExtractRoute = createRoute({
  getParentRoute: () => toolsRoute,
  path: 'audio-extract',
  staticData: { breadcrumb: 'Tách âm thanh' } satisfies RouteBreadcrumbStatic,
  context: (): AudioExtractRouteContextSlice => ({
    audioExtract: {
      slug: 'audio-extract',
      title: 'Tách âm thanh'
    }
  }),
  component: AudioExtractorPage
})

const imageSmartCropRoute = createRoute({
  getParentRoute: () => toolsRoute,
  path: 'image-smart-crop',
  staticData: { breadcrumb: 'Smart crop ảnh' } satisfies RouteBreadcrumbStatic,
  context: (): ImageSmartCropRouteContextSlice => ({
    imageSmartCrop: {
      slug: 'image-smart-crop',
      title: 'Smart crop ảnh'
    }
  }),
  validateSearch: parseImageSmartCropSearch,
  component: ImageSmartCropPage
})

const imageFormatConvertRoute = createRoute({
  getParentRoute: () => toolsRoute,
  path: 'image-format-convert',
  staticData: { breadcrumb: 'Đổi định dạng' } satisfies RouteBreadcrumbStatic,
  context: (): ImageFormatConvertRouteContextSlice => ({
    imageFormatConvert: {
      slug: 'image-format-convert',
      title: 'Đổi định dạng',
      pageTitle: 'Đổi định dạng'
    }
  }),
  validateSearch: parseImageFormatConvertSearch,
  component: ImageFormatConvertPage
})

const imageDocumentMergeRoute = createRoute({
  getParentRoute: () => toolsRoute,
  path: 'image-document-merge',
  staticData: { breadcrumb: 'Ghép PDF/DOCX' } satisfies RouteBreadcrumbStatic,
  component: ImageDocumentMergePage
})

const imageWatermarkRoute = createRoute({
  getParentRoute: () => toolsRoute,
  path: 'image-watermark',
  staticData: { breadcrumb: 'Gắn watermark' } satisfies RouteBreadcrumbStatic,
  context: (): ImageWatermarkRouteContextSlice => ({
    imageWatermark: {
      slug: 'image-watermark',
      title: 'Gắn watermark',
      pageTitle: 'Gắn watermark'
    }
  }),
  component: ImageWatermarkPage
})

const watermarkRemoveRoute = createRoute({
  getParentRoute: () => toolsRoute,
  path: 'watermark-remove',
  staticData: { breadcrumb: 'Xóa watermark' } satisfies RouteBreadcrumbStatic,
  context: (): WatermarkRemoveRouteContextSlice => ({
    watermarkRemove: {
      slug: 'watermark-remove',
      title: 'Xóa watermark',
      pageTitle: 'Xóa watermark'
    }
  }),
  component: WatermarkRemovePage
})

const imageSmartCropBatchRedirectRoute = createRoute({
  getParentRoute: () => toolsRoute,
  path: 'image-smart-crop-batch',
  beforeLoad: () => {
    throw redirect({
      to: '/tools/image-smart-crop',
      search: { mode: 'batch' },
      replace: true
    })
  }
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'settings',
  staticData: { breadcrumb: 'Cài đặt' } satisfies RouteBreadcrumbStatic,
  component: SettingsPage
})

export const routeTree = rootRoute.addChildren([
  rootIndexRoute,
  toolsRoute.addChildren([
    chromaVideoRoute,
    videoCompressRoute,
    audioExtractRoute,
    imageSmartCropRoute,
    imageFormatConvertRoute,
    imageDocumentMergeRoute,
    imageWatermarkRoute,
    watermarkRemoveRoute,
    imageSmartCropBatchRedirectRoute
  ]),
  settingsRoute
])
