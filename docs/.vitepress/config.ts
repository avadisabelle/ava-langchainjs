import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "AvaLangStack",
  description: "Documentation for the AvaLangStack Narrative Intelligence Ecosystem",
  lang: 'en-US',
  base: '/chain.avalangstack.sanctuaireagentique.com/', // Set base URL for deployment on subdomain
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }] // Add a favicon
  ],
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started' }
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is AvaLangStack?', link: '/' },
          { text: 'Getting Started', link: '/getting-started' }
        ]
      },
      {
        text: 'Core Packages',
        items: [
          { text: 'Inquiry Routing', link: '/packages/inquiry-routing' },
          { text: 'Narrative Tracing', link: '/packages/narrative-tracing' },
          { text: 'Prompt Decomposition', link: '/packages/prompt-decomposition' },
          { text: 'Relational Intelligence', link: '/packages/relational-intelligence' },
          { text: 'State Machine Spec', link: '/packages/state-machine-spec' }
        ]
      },
      {
        text: 'RISE Specifications',
        items: [
          { text: 'RISE Framework Overview', link: '/rispecs/README' },
          { text: 'Inquiry Routing (01)', link: '/rispecs/01-inquiry-routing.spec' },
          { text: 'Narrative Tracing', link: '/rispecs/narrative-tracing/narrative-tracing.spec' },
          { text: 'Prompt Decomposition', link: '/rispecs/prompt-decomposition/prompt-decomposition.spec' },
          { text: 'Relational Intelligence', link: '/rispecs/relational-intelligence/relational-intelligence.spec' },
          { text: 'State Machine Spec', link: '/rispecs/state-machine-spec/state-machine-spec.spec' },
          { text: 'LLMs Overview (Concise)', link: '/llms' },
          { text: 'LLMs Overview (Full)', link: '/llms-full' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/avadisabelle/avalangstack' }
    ],

    footer: {
      message: 'Built with VitePress. Narrative Intelligence by AvaLangStack.',
      copyright: 'Copyright © 2024 Ava Isabelle'
    }
  }
})
