import ExcelJS from 'exceljs'
import fs from 'node:fs/promises'
import path from 'node:path'

const rootDir = process.cwd()
const workbookPath = path.join(rootDir, 'data', 'pixcope-services.xlsx')

const SERVICE_HEADERS = [
  'Service ID',
  'Display Name',
  'Price (EUR)',
  'Short Description',
  'Long Description (Rich Text/Markdown)',
  'Images (comma-separated URLs)',
  'Group IDs (comma-separated)',
  'Tag',
  'Bundled Discount (%)',
  'Bundle Pair ID',
]

const GROUP_HEADERS = ['Group ID', 'Display Name', 'Display Order', 'Short Description']
const PARAM_HEADERS = ['ID', 'Display Name', 'Multiplier']
const TAG_HEADERS = ['Tag Name', 'Tag Color (Hex)']

const groups = [
  [
    1,
    '1 Brand Strategy',
    1,
    'Strategic foundation defining market position, naming, messaging, and buyer insight.',
  ],
  [
    2,
    '2 Brand Identity',
    2,
    'Visual system translating strategy into logo, assets, and brand guidelines.',
  ],
  [
    3,
    '3 Website',
    3,
    'Conversion-focused website structure, design, build, and SEO foundations.',
  ],
  [
    4,
    '3A. Website Add-Ons',
    4,
    'Optional extensions for hosting, compliance, ecommerce, analytics, and optimization.',
  ],
  [
    5,
    '4 Marketing & Brand Awareness',
    5,
    'Visibility and acquisition systems for search, paid reach, and authority.',
  ],
]

const timeline = [
  [1, 'Standard', 1.0],
  [2, 'Swift', 1.4],
  [3, 'Urgent', 2.0],
]

const complexity = [
  [1, 'Simple Project', 0.7],
  [2, 'Standard', 1.0],
  [3, 'Complex', 1.5],
]

const tagOptions = []

const services = [
  // 01 Brand Strategy
  {
    id: 101,
    name: '1.01 Brand Strategy & Positioning',
    groupId: 1,
    price: 670,
    short:
      'Defines business goals, ideal customers, value proposition, and market positioning into one clear direction.',
    long: '',
  },
  {
    id: 102,
    name: '1.02 Brand Naming',
    groupId: 1,
    price: 600,
    short:
      'Develops, tests, and refines distinctive name options with digital availability and linguistic screening.',
    long: '',
  },
  {
    id: 103,
    name: '1.03 Competitive Landscape Analysis',
    groupId: 1,
    price: 650,
    short:
      'Reviews competitors across offers, pricing, messaging, and funnels to identify gaps and advantages.',
    long: '',
  },
  {
    id: 104,
    name: '1.04 Messaging System & Go-to-Market Kit',
    groupId: 1,
    price: 470,
    short:
      'Creates a cohesive narrative, voice, core offers, and launch direction for website and sales alignment.',
    long: '',
  },
  {
    id: 105,
    name: '1.05 Buyer Research',
    groupId: 1,
    price: 500,
    short:
      'Analyzes customer insights to uncover pain points, triggers, and objections that sharpen positioning.',
    long: '',
  },

  // 02 Brand Identity
  {
    id: 201,
    name: '2.01 Creative Direction',
    groupId: 2,
    price: 450,
    short:
      'Defines color, typography, imagery, and layout principles that guide all design execution.',
    long: '',
  },
  {
    id: 202,
    name: '2.02 Brandmark Design',
    groupId: 2,
    price: 870,
    short:
      'Creates a distinctive logo system with exploration, refinement, and a complete asset suite.',
    long: '',
  },
  {
    id: 203,
    name: '2.03 Print Designs Starter Pack',
    groupId: 2,
    price: 220,
    short:
      'Designs essential print materials like business cards, letterheads, and stickers for consistency.',
    long: '',
  },
  {
    id: 204,
    name: '2.04 Digital Designs Starter Pack',
    groupId: 2,
    price: 220,
    short:
      'Core digital assets including LinkedIn backgrounds, email signatures, and editable templates.',
    long: '',
  },
  {
    id: 205,
    name: '2.05 Brand Guidelines',
    groupId: 2,
    price: 900,
    short:
      'Documents logo usage, color systems, typography, imagery, and layout rules for consistency.',
    long: '',
  },
  {
    id: 206,
    name: '2.06 Social Media Templates',
    groupId: 2,
    price: 470,
    short:
      'Creates a flexible template system for posts, stories, and carousels across platforms.',
    long: '',
  },
  {
    id: 207,
    name: '2.07 Logo Animation',
    groupId: 2,
    price: 350,
    short:
      'Delivers a motion version of the logo for digital media and presentations.',
    long: '',
  },
  {
    id: 208,
    name: '2.08 Trade Fair Booth Design',
    groupId: 2,
    price: 700,
    short:
      'Designs large-format booth visuals tailored to messaging and physical space constraints.',
    long: '',
  },
  {
    id: 209,
    name: '2.09 Brochure Design',
    groupId: 2,
    price: 400,
    short:
      'Creates a structured print document presenting offers or company information clearly.',
    long: '',
  },
  {
    id: 210,
    name: '2.10 Roll-Up Banner Design',
    groupId: 2,
    price: 400,
    short:
      'Designs a vertical display layout with clear hierarchy for quick readability.',
    long: '',
  },
  {
    id: 211,
    name: '2.11 Flyer Design',
    groupId: 2,
    price: 400,
    short:
      'Creates a concise promotional layout for fast consumption in print or digital.',
    long: '',
  },
  {
    id: 212,
    name: '2.12 Slide Deck Template Design',
    groupId: 2,
    price: 900,
    short:
      'Builds branded presentation layouts, typography, and visuals for consistent decks.',
    long: '',
  },

  // 03 Website
  {
    id: 301,
    name: '3.01 Website Structure',
    groupId: 3,
    price: 550,
    short:
      'Defines sitemap, navigation, and page hierarchy aligned with SEO and conversion goals.',
    long: '',
  },
  {
    id: 302,
    name: '3.02 Wireframes & Content Planning',
    groupId: 3,
    price: 770,
    short:
      'Maps page sections, calls-to-action, and conversion paths for each key page.',
    long: '',
  },
  {
    id: 303,
    name: '3.03 Custom Website Design',
    groupId: 3,
    price: 1400,
    short:
      'Delivers tailored UI designs for homepage and key pages with strong hierarchy.',
    long: '',
  },
  {
    id: 304,
    name: '3.04 Wix Studio Setup',
    groupId: 3,
    price: 900,
    short:
      'Implements approved designs in Wix Studio with performance-ready configuration.',
    long: '',
  },
  {
    id: 305,
    name: '3.05 Website Copywriting',
    groupId: 3,
    price: 570,
    short:
      'Writes strategic website copy aligned with positioning and search intent.',
    long: '',
  },
  {
    id: 306,
    name: '3.06 CMS Setup',
    groupId: 3,
    price: 350,
    short:
      'Configures structured content management for dynamic pages like blogs and listings.',
    long: '',
  },
  {
    id: 307,
    name: '3.07 Blog Setup',
    groupId: 3,
    price: 100,
    short:
      'Creates a structured blog with categories, navigation, and initial configuration.',
    long: '',
  },
  {
    id: 308,
    name: '3.08 Forms & Integrations',
    groupId: 3,
    price: 240,
    short:
      'Configures enquiry forms and CRM/email integrations for reliable lead capture.',
    long: '',
  },
  {
    id: 309,
    name: '3.09 On-Page SEO Setup',
    groupId: 3,
    price: 220,
    short:
      'Implements metadata, headings, structured data, and performance improvements.',
    long: '',
  },
  {
    id: 310,
    name: '3.10 Responsive Optimization',
    groupId: 3,
    price: 1,
    short:
      'Adapts layouts and typography across desktop, tablet, and mobile devices.',
    long: '',
  },
  {
    id: 311,
    name: '3.11 QA & Review',
    groupId: 3,
    price: 1,
    short:
      'Tests functionality, performance, accessibility, and cross-browser behavior.',
    long: '',
  },
  {
    id: 312,
    name: '3.12 Launch & Stabilization',
    groupId: 3,
    price: 1,
    short:
      'Manages go-live, domain connection, indexing checks, and early monitoring.',
    long: '',
  },
  {
    id: 313,
    name: '3.13 Training & Handover',
    groupId: 3,
    price: 1,
    short:
      'Onboards the team for content updates and ongoing site management.',
    long: '',
  },

  // 03A Website Add-Ons
  {
    id: 401,
    name: '3A.01 Website Hosting & Domain',
    groupId: 4,
    price: 300,
    short:
      'Registers domain and sets up managed hosting for secure, accessible delivery.',
    long: '',
  },
  {
    id: 402,
    name: '3A.02 Legal & Compliance Package',
    groupId: 4,
    price: 250,
    short:
      'Implements legal documents and consent mechanisms for compliance.',
    long: '',
  },
  {
    id: 403,
    name: '3A.03 Online Course Setup',
    groupId: 4,
    price: 500,
    short:
      'Configures gated learning environment with payments and progress tracking.',
    long: '',
  },
  {
    id: 404,
    name: '3A.04 Online Store Setup',
    groupId: 4,
    price: 800,
    short:
      'Sets up ecommerce with products, payments, shipping, and tax settings.',
    long: '',
  },
  {
    id: 405,
    name: '3A.05 Online Booking Setup',
    groupId: 4,
    price: 900,
    short:
      'Configures scheduling with availability, confirmations, and payment integration.',
    long: '',
  },
  {
    id: 406,
    name: '3A.06 Business Email Setup',
    groupId: 4,
    price: 120,
    short:
      'Sets up a professional mailbox with DNS records and device configuration.',
    long: '',
  },
  {
    id: 407,
    name: '3A.07 Email Deliverability Setup',
    groupId: 4,
    price: 200,
    short:
      'Configures SPF, DKIM, and DMARC to improve inbox placement.',
    long: '',
  },
  {
    id: 408,
    name: '3A.08 Payments & Tax Setup',
    groupId: 4,
    price: 200,
    short:
      'Configures payment processors, currencies, and tax settings for compliance.',
    long: '',
  },
  {
    id: 409,
    name: '3A.09 Additional Article Writing',
    groupId: 4,
    price: 90,
    short:
      'Writes one structured, search-optimised article aligned with keyword strategy.',
    long: '',
  },
  {
    id: 410,
    name: '3A.10 Multilingual Website',
    groupId: 4,
    price: 400,
    short:
      'Expands website into additional languages with hreflang and localized SEO.',
    long: '',
  },
  {
    id: 411,
    name: '3A.11 Structured Data Essentials',
    groupId: 4,
    price: 400,
    short:
      'Implements schema markup to enhance search engine understanding and visibility.',
    long: '',
  },
  {
    id: 412,
    name: '3A.12 Redirects & Content Migration',
    groupId: 4,
    price: 350,
    short:
      'Maps URLs and migrates content with 301 redirects to preserve search equity.',
    long: '',
  },
  {
    id: 413,
    name: '3A.13 Analytics & Conversion Tracking',
    groupId: 4,
    price: 650,
    short:
      'Sets up GA4, custom events, and conversion measurement for performance insights.',
    long: '',
  },
  {
    id: 414,
    name: '3A.14 Accessibility Optimization',
    groupId: 4,
    price: 450,
    short:
      'Improves navigation, contrast, and assistive compatibility across devices.',
    long: '',
  },

  // 04 Marketing & Brand Awareness
  {
    id: 501,
    name: '4.01 Google Business Profile Setup & Optimization',
    groupId: 5,
    price: 500,
    short:
      'Sets up and optimizes Google Business Profile with categories, media, and tracking.',
    long: '',
  },
  {
    id: 502,
    name: '4.02 Business Listings & Citations Pack',
    groupId: 5,
    price: 700,
    short:
      'Creates and corrects listings across directories for consistent local SEO data.',
    long: '',
  },
  {
    id: 503,
    name: '4.03 Rich Snippets Implementation',
    groupId: 5,
    price: 700,
    short:
      'Implements structured data markup to enhance search listing visibility.',
    long: '',
  },
  {
    id: 504,
    name: '4.04 Backlink Acquisition Pack',
    groupId: 5,
    price: 1500,
    short:
      'Secures high-quality backlinks to strengthen domain authority and rankings.',
    long: '',
  },
  {
    id: 505,
    name: '4.05 Press Release & Distribution',
    groupId: 5,
    price: 1400,
    short:
      'Drafts and distributes press releases to targeted media contacts and wire services.',
    long: '',
  },
  {
    id: 506,
    name: '4.06 Influencer Collaboration',
    groupId: 5,
    price: 2000,
    short:
      'Coordinates vetted creator collaborations aligned with campaign goals.',
    long: '',
  },
  {
    id: 507,
    name: '4.07 Search Ads Campaign',
    groupId: 5,
    price: 450,
    short:
      'Sets up and manages paid search campaigns with keyword and conversion strategy.',
    long: '',
  },
  {
    id: 508,
    name: '4.08 Social Ads Campaign',
    groupId: 5,
    price: 550,
    short:
      'Sets up paid social campaigns with defined audiences, creatives, and tracking.',
    long: '',
  },
  {
    id: 509,
    name: '4.09 Retargeting & Remarketing Campaign',
    groupId: 5,
    price: 900,
    short:
      'Segments audiences and sequences ads to re-engage warm prospects.',
    long: '',
  },
]

const shouldKeepLongDescription = () => false

const addServiceRow = (sheet, service) => {
  const longDescription = shouldKeepLongDescription(service) ? service.long : ''
  const row = sheet.addRow([
    service.id,
    service.name,
    service.price,
    service.short,
    longDescription,
    Array.isArray(service.images) ? service.images.join(',') : '',
    String(service.groupId),
    service.tag ?? '',
    service.bundledDiscount ?? '',
    service.bundlePairId ?? '',
  ])
  row.commit()
}

const styleHeaderRow = (row) => {
  row.eachCell((cell) => {
    cell.font = { bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF1F5' } }
  })
}

const setColumnWidths = (sheet, widths) => {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })
}

const workbook = new ExcelJS.Workbook()
const servicesSheet = workbook.addWorksheet('Services')
servicesSheet.addRow(SERVICE_HEADERS)
styleHeaderRow(servicesSheet.getRow(1))
setColumnWidths(servicesSheet, [12, 32, 14, 34, 54, 32, 24, 22, 18, 36])
services.forEach((service) => addServiceRow(servicesSheet, service))

const groupsSheet = workbook.addWorksheet('Groups')
groupsSheet.addRow(GROUP_HEADERS)
styleHeaderRow(groupsSheet.getRow(1))
setColumnWidths(groupsSheet, [10, 26, 16, 42])
groups.forEach((group) => groupsSheet.addRow(group))

const timelineSheet = workbook.addWorksheet('Timeline Parameters')
timelineSheet.addRow(PARAM_HEADERS)
styleHeaderRow(timelineSheet.getRow(1))
setColumnWidths(timelineSheet, [10, 24, 14])
timeline.forEach((row) => timelineSheet.addRow(row))

const complexitySheet = workbook.addWorksheet('Complexity Parameters')
complexitySheet.addRow(PARAM_HEADERS)
styleHeaderRow(complexitySheet.getRow(1))
setColumnWidths(complexitySheet, [10, 24, 14])
complexity.forEach((row) => complexitySheet.addRow(row))

const tagsSheet = workbook.addWorksheet('Tag Options')
tagsSheet.addRow(TAG_HEADERS)
styleHeaderRow(tagsSheet.getRow(1))
setColumnWidths(tagsSheet, [26, 16])
tagOptions.forEach((row) => tagsSheet.addRow(row))

for (let rowNum = 2; rowNum <= 2000; rowNum += 1) {
  servicesSheet.getCell(`H${rowNum}`).dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: ["'Tag Options'!$A$2:$A$500"],
  }
  servicesSheet.getCell(`G${rowNum}`).dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: ['Groups!$A$2:$A$500'],
  }
  servicesSheet.getCell(`J${rowNum}`).dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: ['Services!$A$2:$A$2000'],
  }
}

await fs.mkdir(path.dirname(workbookPath), { recursive: true })
await workbook.xlsx.writeFile(workbookPath)

console.log('Seeded workbook at', workbookPath)
