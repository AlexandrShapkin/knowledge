import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import { FileTrieNode } from "./quartz/util/fileTrie"

const hideBangFolders = (node: FileTrieNode): boolean => {
  const path = node.slug ?? node.name ?? ""
  return !path.split("/").some((part) => part.startsWith("!"))
}

const explorer = Component.Explorer({
  filterFn: hideBangFolders,
  useSavedState: false,
})

const topControls = Component.Flex({
  components: [
    { Component: Component.Search(), grow: true },
    { Component: Component.Darkmode() },
    { Component: Component.ReaderMode() },
  ],
})

const leftSidebar = [Component.PageTitle(), Component.MobileOnly(Component.Spacer()), topControls, explorer]

const rightSidebar = [
  Component.Graph(),
  Component.DesktopOnly(Component.TableOfContents()),
  Component.Backlinks(),
]

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/AlexandrShapkin/knowledge-base",
      Telegram: "https://t.me/AlexandrShapkin",
      "Quartz GitHub": "https://github.com/jackyzha0/quartz",
    },
  }),
}

// components for pages that display a single page
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: leftSidebar,
  right: rightSidebar,
}

// components for pages that display lists of pages
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: leftSidebar,
  right: rightSidebar,
}