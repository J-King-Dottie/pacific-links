import { useRef, useState, useEffect, useLayoutEffect } from 'react'
import { ArrowLeft, ChevronDown, ChevronUp, Info, Pause, Play, X } from 'lucide-react'
import { PACIFIC_LIST } from '../data/pacificCountries.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import './SidePanel.css'

// Bottom-sheet snap points on phones, as fractions of viewport height.
const SHEET_SNAPS = { peek: 0.12, half: 0.5, full: 0.9 }

const METRIC_LABELS = { aid: 'Aid', aid_committed: 'Aid', trade: 'Trade', exports: 'Trade', remittances: 'Remittances', migration: 'Migration', students: 'Students', security: 'Security', security_arms: 'Security', debt: 'Debt', investment: 'Investment', fdi: 'Investment', portfolio: 'Investment' }
const AID_MODE_LABELS = { aid: 'Spent', aid_committed: 'Committed' }
const TRADE_MODE_LABELS = { trade: 'Imports', exports: 'Exports' }
const SECURITY_MODE_LABELS = { security: 'Assistance', security_arms: 'Arms' }
const INVESTMENT_MODE_LABELS = { fdi: 'FDI', portfolio: 'Portfolio' }

function isAidMetric(metric) {
  return ['aid', 'aid_committed'].includes(metric)
}

function isTradeMetric(metric) {
  return ['trade', 'exports'].includes(metric)
}

function isSecurityMetric(metric) {
  return ['security', 'security_arms'].includes(metric)
}

function isInvestmentMetric(metric) {
  return ['fdi', 'portfolio'].includes(metric)
}

function isPeopleMetric(metric) {
  return ['migration', 'students'].includes(metric)
}

const DENOMINATOR_SOURCES = {
  gdp: [
    { text: 'World Bank', url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.CD' },
    { text: 'UN SNAAMA', url: 'https://unstats.un.org/unsd/snaama/' },
    { text: 'Niue Statistics Office National Accounts', url: 'https://niuestatistics.nu/economic/national-accounts-estimates-of-niue-2024/' },
  ],
  population: [
    { text: 'World Bank', url: 'https://data.worldbank.org/indicator/SP.POP.TOTL' },
    { text: 'UN SNAAMA', url: 'https://unstats.un.org/unsd/snaama/' },
    { text: 'Niue Statistics Office National Accounts', url: 'https://niuestatistics.nu/economic/national-accounts-estimates-of-niue-2024/' },
  ],
}

// Trade and exports are the same dataset read in two directions, so they share
// one explainer and one processing note covering both imports and exports.
const TRADE_WHY = 'Trade is one of the most concrete economic ties a country has, so seeing which partners Pacific economies buy goods from and sell goods to shows where their everyday economic relationships actually run. Several sources report it. Pacific Data Hub IMTS shows reported Pacific trade, and UN Comtrade is the global source behind most reported goods trade. But importer and exporter reports often disagree on partner, value, freight, classification, re-exports, and timing. We use CEPII BACI because it starts from Comtrade and reconciles those reports into one country-to-country figure, which is what lets us compare relationships across many countries. These are recorded goods trade, not a measure of domestic consumption or production. The Marshall Islands is the clearest case to watch, where its ship registry and fuel activity can make recorded trade look enormous, even though much of it is tied to vessels and registration rather than goods used or produced on the islands.'

const TRADE_CHANGED = 'From the BACI data we keep the country-to-country figures and group them by Pacific country, partner country, year, and broad product group. Services are not included. The values are reconciled goods trade in current US dollars.'

const METRIC_INFO = {
  aid: {
    source: 'Lowy Institute Pacific Aid Map via Pacific Data Hub',
    sourceUrl: 'https://pacificdata.org/data/dataset/pacific-aid-and-development-finance-data-from-the-lowy-institute-df-pam',
    coverage: 'The dashboard covers 14 Pacific island countries from 2010 to 2024. This view shows aid money that donors actually spent in Pacific countries, in current US dollars. The most recent year is partial and rises as donors finish reporting.',
    why: 'Aid is one of the biggest ways outside countries build a presence in the Pacific, so how much a partner funds a country, and how steadily, is a direct read on how invested they are in it. We use the Lowy Pacific Aid Map because it is the most complete public source for Pacific aid and development finance, bringing donor-by-donor data into one consistent dataset. Broader databases like the OECD reporting system cover aid globally, but Lowy is built for the Pacific and includes donors those datasets can miss, such as China. For a very small economy, a single large project can look huge as a share of GDP, so read big numbers in context.',
    changed: 'From the Lowy data we keep direct donor-to-country aid and remove aggregate donor categories, so the table shows individual donor relationships only. The dollar figures are Lowy\'s. This metric can be toggled between money spent and money promised. These are separate views and should not be added together.',
    denominator: 'GDP uses [World Bank] where available; [UN SNAAMA] for Cook Islands; [Niue Statistics Office National Accounts] for Niue.',
    denominatorLinks: DENOMINATOR_SOURCES.gdp,
  },
  aid_committed: {
    source: 'Lowy Institute Pacific Aid Map via Pacific Data Hub',
    sourceUrl: 'https://pacificdata.org/data/dataset/pacific-aid-and-development-finance-data-from-the-lowy-institute-df-pam',
    coverage: 'The dashboard covers 14 Pacific island countries from 2010 to 2024. This view shows aid money that donors promised to Pacific countries, in current US dollars. Promised aid can be announced before money is actually spent.',
    why: 'Promised aid is money a partner has committed but not necessarily spent, so it shows where outside countries are signalling future intent in the Pacific before the money actually moves. We use the Lowy Pacific Aid Map because it is the most complete public source for Pacific aid and development finance, bringing donor-by-donor data into one consistent dataset. Broader databases like the OECD reporting system cover aid globally, but Lowy is built for the Pacific and includes donors those datasets can miss, such as China. A commitment can be announced well before anything is delivered, and for a small economy a single pledge can look huge as a share of GDP.',
    changed: 'From the Lowy data we keep direct donor-to-country aid and remove aggregate donor categories, so the table shows individual donor relationships only. The dollar figures are Lowy\'s. This metric can be toggled between money spent and money promised. These are separate views and should not be added together.',
    denominator: 'GDP uses [World Bank] where available; [UN SNAAMA] for Cook Islands; [Niue Statistics Office National Accounts] for Niue.',
    denominatorLinks: DENOMINATOR_SOURCES.gdp,
  },
  trade: {
    source: 'CEPII BACI reconciled bilateral trade data',
    sourceUrl: 'https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37',
    coverage: 'The dashboard covers 14 Pacific island countries from 2010 to 2024. This view shows goods that Pacific countries buy from other countries each year, in current US dollars. Services are not included.',
    why: TRADE_WHY,
    changed: TRADE_CHANGED,
    denominator: 'GDP uses [World Bank] where available; [UN SNAAMA] for Cook Islands; [Niue Statistics Office National Accounts] for Niue.',
    denominatorLinks: DENOMINATOR_SOURCES.gdp,
  },
  exports: {
    source: 'CEPII BACI reconciled bilateral trade data',
    sourceUrl: 'https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37',
    coverage: 'The dashboard covers 14 Pacific island countries from 2010 to 2024. This view shows goods that Pacific countries sell to other countries each year, in current US dollars. Services are not included.',
    why: TRADE_WHY,
    changed: TRADE_CHANGED,
    denominator: 'GDP uses [World Bank] where available; [UN SNAAMA] for Cook Islands; [Niue Statistics Office National Accounts] for Niue.',
    denominatorLinks: DENOMINATOR_SOURCES.gdp,
  },
  remittances: {
    source: 'World Bank and KNOMAD Bilateral Remittance Matrices',
    sourceUrl: 'https://web.archive.org/web/20231119232039/https://www.knomad.org/data/remittances',
    sourceLinks: [
      { text: '2021 matrix download', url: 'https://thedocs.worldbank.org/en/doc/cf8eee7ff5029398f75e897b342e7320-0050122023/related/WB-KNOMAD.xlsx' },
      { text: '2018 matrix download', url: 'https://thedocs.worldbank.org/en/doc/904591573826885707-0090022019/original/Bilateralremittancematrix2018Oct2019.xlsx' },
      { text: '2017 matrix archive', url: 'https://web.archive.org/web/20190124090151id_/http://pubdocs.worldbank.org/en/705611533661084197/bilateralremittancematrix2017-Apr2018.xlsx' },
      { text: '2010 matrix archive', url: 'https://web.archive.org/web/20160531235700id_/http://pubdocs.worldbank.org:80/pubdocs/publicdoc/2015/9/895701443117529385/Bilateral-Remittance-Matrix-2010.xlsx' },
    ],
    coverage: 'The dashboard covers 14 Pacific island countries. This view shows money sent home to Pacific countries from people overseas, in current US dollars, for benchmark years only: 2010, 2017, 2018 and 2021.',
    why: 'Remittances are money sent home by people living overseas, so they trace the living link between a Pacific country and its diaspora, one of the most personal relationships on the map. Most remittance data shows only national totals. The World Bank and KNOMAD matrices are the only public source we could find that estimates the country-to-country links behind those totals, which is the relationship this map needs. These are modelled estimates for benchmark years only, not a complete yearly record. Current public pages mostly show totals, so we link to the archived KNOMAD page that held the matrix downloads.',
    changed: 'From the matrices we keep the country-to-country rows and remove non-country aggregates. The source provides benchmark years only, and we leave it that way. We do not fill in missing years or re-estimate transfers. The values are the published modelled estimates in current US dollars.',
    denominator: 'GDP uses [World Bank] where available; [UN SNAAMA] for Cook Islands; [Niue Statistics Office National Accounts] for Niue.',
    denominatorLinks: DENOMINATOR_SOURCES.gdp,
  },
  fdi: {
    source: 'IMF Direct Investment Positions by Counterpart Economy',
    sourceUrl: 'https://data.imf.org/en/datasets/IMF.STA:DIP',
    coverage: 'The dashboard covers 14 Pacific island countries from 2010 to 2024. This view shows direct business investment from overseas into Pacific countries that is still recorded at the end of each year, in current US dollars.',
    why: 'FDI is foreign ownership of real businesses, so it shows which outside countries actually own a piece of a Pacific economy. That kind of ownership is one of the most durable footprints a partner can have, because it means a lasting presence on the ground rather than a one-off payment. We use the IMF Direct Investment Positions, the standard public source for cross-border investment between counterpart economies, and show the year-end amount because the map is about what has built up and is still there. National figures exist but are not reported consistently country-to-country, which is why we rely on the IMF series. It tends to capture larger or better-reported investments and can miss smaller businesses, so a missing value means the source does not report that pair, not that no link exists. The Marshall Islands is the clearest case to watch, where its ship registry and corporate structures can create very large recorded values, far bigger than the domestic economy, without much real activity on the islands.',
    changed: 'From the IMF data we keep investment into the 14 Pacific countries, convert country codes to the app codes, remove zero-value rows, calculate each value as a share of GDP, and keep only the years 2010 to 2024. The file does not say what the investment was for, so there is no company, project, or sector detail. Where a country does not report its own positions, the IMF uses partner-reported mirror data, which can repeat odd-looking values across countries, so read these as broad signals. The map and table rank positive values only. Negative values remain in the download.',
    denominator: 'GDP uses [World Bank] where available; [UN SNAAMA] for Cook Islands; [Niue Statistics Office National Accounts] for Niue.',
    denominatorLinks: DENOMINATOR_SOURCES.gdp,
  },
  portfolio: {
    source: 'IMF Portfolio Investment Positions by Counterpart Economy',
    sourceUrl: 'https://data.imf.org/en/datasets/IMF.STA:PIP',
    coverage: 'The dashboard covers 14 Pacific island countries from 2010 to 2024. This view shows overseas money invested in Pacific shares and bonds, in current US dollars. The IMF reports positive values for 13 of the 14 countries in this pull.',
    why: 'Portfolio investment is money held in a country\'s shares and bonds without running the business behind them. It is a more arms-length tie than direct ownership, but it still shows where outside money is exposed to a Pacific economy and which partners hold a financial stake in it. We use the IMF Portfolio Investment Positions, the standard public source between counterpart economies, which reports who holds Pacific-linked shares and bonds. As with FDI, national data is not reported consistently country-to-country, so the IMF series is the workable option, and it does not show where Pacific residents invest overseas because that direction is mostly missing. These are reported holdings rather than a measure of local investment markets, and Marshall Islands figures in particular can be distorted by its ship registry and corporate structures.',
    changed: 'From the IMF data we keep records where another country reports holdings of shares or bonds from the 14 Pacific countries, convert country codes to the app codes, remove zero-value rows, calculate each value as a share of GDP, and keep only the years 2010 to 2024. The file does not identify the issuer, security, or sector behind a holding. These are year-end holdings, not money newly invested during the year.',
    denominator: 'GDP uses [World Bank] where available; [UN SNAAMA] for Cook Islands; [Niue Statistics Office National Accounts] for Niue.',
    denominatorLinks: DENOMINATOR_SOURCES.gdp,
  },
  migration: {
    source: 'UN International Migrant Stock 2024',
    sourceUrl: 'https://www.un.org/development/desa/pd/content/international-migrant-stock',
    coverage: 'The dashboard covers 14 Pacific island countries. This view shows people born in a Pacific country who live overseas, counted as people, not yearly moves, for benchmark years only: 2010, 2015, 2020 and 2024.',
    why: 'Migration shows people born in a Pacific country who now live overseas, the human footprint of the region\'s connections and the root of family, labour, education, and remittance ties. We use the UN International Migrant Stock, the standard public source for where people born in one country are living, and count people living overseas rather than annual moves because the map is about long-running ties. National censuses record some of this, but only the UN matrix puts it into one consistent country-to-country form. In some small islands more people live overseas than at home, so shares can be over 100%, and a missing pair means the UN matrix has no value, not that the link does not exist.',
    changed: 'From the UN data we keep the country-to-country rows and remove regional and aggregate destinations. The source provides benchmark years only, and we leave it that way. The figures are counts of people, not yearly moves. A blank can hide a real community. The UN matrix shows no Vanuatu-born people in New Zealand, even though New Zealand\'s census does.',
    denominator: 'Population uses [World Bank] where available; [UN SNAAMA] / implied resident population for Cook Islands; [Niue Statistics Office National Accounts] for Niue.',
    denominatorLinks: DENOMINATOR_SOURCES.population,
  },
  students: {
    source: 'UNESCO UIS Other Policy Relevant Indicators',
    sourceUrl: 'https://databrowser.uis.unesco.org/resources/bulk',
    coverage: 'The dashboard covers 14 Pacific island countries from 2010 to 2024. This view shows Pacific students recorded as studying overseas at university or college level, counted as students. They are not annual departures.',
    why: 'Students shows Pacific Islanders studying overseas, which traces education ties shaped by scholarships, family networks, migration pathways, and the professional links that follow people through their careers. We use the UNESCO UIS data, the standard public source for tertiary students by country of origin. Individual host countries publish their own numbers, but UIS is the only place they are gathered into one comparable cross-country set. The counts can look low because they exclude school-level study and depend on what host-country systems report by origin country, so a missing value is often under-reporting rather than no students.',
    changed: 'From the UIS data we keep the country-to-country higher-education student rows for the 14 Pacific countries, remove self-country and aggregate rows, convert destination codes to the app codes, calculate each value as a share of origin population, and keep only the years 2010 to 2024. The figures are recorded student counts, not dollars, scholarships, or annual departures.',
    denominator: 'Population uses [World Bank] where available; [UN SNAAMA] / implied resident population for Cook Islands; [Niue Statistics Office National Accounts] for Niue.',
    denominatorLinks: DENOMINATOR_SOURCES.population,
  },
  security: {
    source: 'OECD CRS security-related assistance records',
    sourceUrl: 'https://sdmx.oecd.org/dcd-public/rest/dataflow/OECD.DCD.FSD/DSD_CRS@DF_CRS/1.6',
    coverage: 'The dashboard covers 14 Pacific island countries from 2010 to 2024. This view shows security-related assistance spent in Pacific countries, in current US dollars, as reported to the OECD.',
    why: 'Security assistance shows who funds security-related work in Pacific countries, from security system management to civilian peacebuilding, reintegration, and mine action, which is one way outside partners build influence beyond money and trade. We use the OECD Creditor Reporting System, the standard public record of what donors report spending and the only consistent source that tags aid as security-related. This is broader than arms transfers but narrower than all defence cooperation or governance work, so read it as reported security-related spending, not the full picture of security ties.',
    changed: 'From the OECD data we keep rows tagged as security-related, remove aggregate donor groups, convert donor codes to the app codes where possible, keep named UN and EU providers, calculate each value as a share of recipient GDP, and keep only the years 2010 to 2024. The figures are reported amounts spent in current US dollars. They should not be added to the SIPRI arms values.',
    denominator: 'GDP uses [World Bank] where available; [UN SNAAMA] for Cook Islands; [Niue Statistics Office National Accounts] for Niue.',
    denominatorLinks: DENOMINATOR_SOURCES.gdp,
  },
  security_arms: {
    source: 'SIPRI Arms Transfers Database',
    sourceUrl: 'https://armstransfers.sipri.org/ArmsTransfer/TransferRegister',
    coverage: 'The dashboard covers 14 Pacific island countries from 2010 to 2024. This view shows major conventional arms delivered to Pacific countries, as recorded by SIPRI. Rows are sparse because such transfers are uncommon.',
    why: 'Arms shows who supplied major conventional weapons to Pacific countries, the hardest and most direct edge of a security relationship. We use the SIPRI Arms Transfers Database, the standard public record of major weapons transfers. National arms-export reports exist but are patchy and inconsistent, so SIPRI\'s consolidated register is the workable source. Sparse rows are still meaningful, because transfers into the Pacific are uncommon, and SIPRI does not capture small arms, ammunition, routine policing equipment, training, or day-to-day cooperation, so this is only the heavy end.',
    changed: 'From the SIPRI data we keep delivered transfers by delivery year and show line-level equipment where available. The first number is the delivered unit count. The second is SIPRI\'s trend-indicator value (TIV), a points-style estimate of the equipment\'s military weight, not a price or an aid value. For example, 14 second-hand Bushmaster vehicles carry a TIV of about 1.96, because SIPRI rates each at roughly 0.14 points. Where a delivery spans several years, we split the units and TIV evenly across them.',
    denominator: '',
    denominatorLinks: [],
  },
  debt: {
    source: 'World Bank International Debt Statistics',
    sourceUrl: 'https://databank.worldbank.org/source/international-debt-statistics',
    coverage: 'The dashboard covers 14 Pacific island countries, but World Bank IDS reports public external debt for only seven (Fiji, FSM, PNG, Samoa, Solomon Islands, Tonga, Vanuatu). In this pull, positive creditor-level rows cover six: Fiji, PNG, Samoa, Solomon Islands, Tonga, and Vanuatu. This view shows public external debt owed at the end of each year, in current US dollars, by lender.',
    why: 'Debt shows who Pacific countries owe public external money to, a relationship that can shape long-term influence, since a lender often keeps a say in a country\'s choices for years. We use the World Bank International Debt Statistics, the standard public source for reported public external debt, and show money owed at year end rather than new borrowing, so it reads as a map of money still owed. It is the most consistent place creditor-by-creditor debt is reported across countries. Only countries that report to IDS appear, and lenders include multilateral and institutional creditors, not just governments, so an absence can mean no reporting rather than no debt.',
    changed: 'From the IDS data we keep the rows where a Pacific country owed money to a lender in a given year and keep the lender names IDS reports, including multilateral and institutional lenders. The amounts are end-of-year debt stocks in current US dollars, not new loans taken during the year.',
    denominator: 'GDP uses [World Bank] where available; [UN SNAAMA] for Cook Islands; [Niue Statistics Office National Accounts] for Niue.',
    denominatorLinks: DENOMINATOR_SOURCES.gdp,
  },
}
const PAC_NAMES = Object.fromEntries(PACIFIC_LIST.map(c => [c.code, c.name]))

const DEFAULT_ROW_LIMIT = 10

// Colors matching MapView INFLUENCER_COLORS
// The only palette: the eight metric colours, in metric order (same as the map).
const METRIC_PALETTE = ['#8a5c10', '#1e666d', '#507840', '#3c6e71', '#a0442c', '#76516a', '#b45f06', '#45607e']
const METRIC_HEX = {
  aid: '#8a5c10', aid_committed: '#8a5c10',
  trade: '#1e666d', exports: '#1e666d',
  debt: '#507840',
  security: '#3c6e71', security_arms: '#3c6e71',
  remittances: '#a0442c',
  migration: '#76516a',
  students: '#b45f06',
  fdi: '#45607e', portfolio: '#45607e',
}
// First country = the active metric's colour (stable when others are added);
// later countries take the remaining metric colours, in order.
function selectionColor(metric, i) {
  const active = METRIC_HEX[metric] ?? METRIC_PALETTE[0]
  if (i === 0) return active
  const others = METRIC_PALETTE.filter(c => c !== active)
  return others[(i - 1) % others.length]
}

const INTERPRETATION_COPY = {
  default: {
    aid: 'Which Pacific countries receive the most aid money spent by donors?',
    aid_committed: 'Which Pacific countries have the most aid promised?',
    trade: 'Which Pacific countries buy the most goods from overseas?',
    exports: 'Which Pacific countries sell the most goods overseas?',
    remittances: 'Which Pacific countries receive the most money sent home from overseas?',
    migration: 'Which Pacific countries have the most people living overseas?',
    students: 'Which Pacific countries have the most students overseas?',
    security: 'Which Pacific countries receive the most security assistance from overseas?',
    security_arms: 'Which Pacific countries receive the most major conventional arms from overseas?',
    debt: 'Which Pacific countries owe the most public debt to overseas lenders?',
    fdi: 'Which Pacific countries have the most direct business investment coming in from overseas?',
    portfolio: 'Which Pacific countries have the most overseas money invested in their shares and bonds?',
  },
  pacific: {
    aid: 'Who spends the most aid in the selected Pacific country?',
    aid_committed: 'Who has promised the most aid to the selected Pacific country?',
    trade: 'Who sells the most goods to the selected Pacific country?',
    exports: 'Who buys the most goods from the selected Pacific country?',
    remittances: 'Where does money sent home to the selected Pacific country come from?',
    migration: 'Where do people from the selected Pacific country live overseas?',
    students: 'Where do students from the selected Pacific country study overseas?',
    security: 'Who funds the most security assistance in the selected Pacific country?',
    security_arms: 'Who supplies major conventional arms to the selected Pacific country?',
    debt: 'Who has lent money to the selected Pacific country?',
    fdi: 'Which overseas countries have the most direct business investment in the selected Pacific country?',
    portfolio: 'Which countries have money invested in shares and bonds from the selected Pacific country?',
  },
  influencer: {
    aid: 'Where in the Pacific does the selected outside partner spend the most aid?',
    aid_committed: 'Where in the Pacific has the selected outside partner promised the most aid?',
    trade: 'Where in the Pacific does the selected outside partner sell the most goods?',
    exports: 'Where in the Pacific does the selected outside partner buy the most goods?',
    remittances: 'Where in the Pacific does money from people in the selected outside partner go?',
    migration: 'Which Pacific-born communities live in the selected outside partner?',
    students: 'Students from which Pacific countries study in the selected outside partner?',
    security: 'Where in the Pacific does the selected partner fund security assistance?',
    security_arms: 'Where in the Pacific does the selected supplier send major conventional arms?',
    debt: 'Where in the Pacific has the selected outside partner lent money?',
    fdi: 'Where in the Pacific does the selected outside partner have direct business investment?',
    portfolio: 'Where in the Pacific does the selected outside partner have money invested in shares and bonds?',
  },
  pacificComparison: {
    aid: 'Who spends the most aid in the selected Pacific countries?',
    aid_committed: 'Who has promised the most aid to the selected Pacific countries?',
    trade: 'Who sells the most goods to the selected Pacific countries?',
    exports: 'Who buys the most goods from the selected Pacific countries?',
    remittances: 'Where does money sent home to the selected Pacific countries come from?',
    migration: 'Where do people from the selected Pacific countries live overseas?',
    students: 'Where do students from the selected Pacific countries study overseas?',
    security: 'Who funds the most security assistance in the selected Pacific countries?',
    security_arms: 'Who supplies major conventional arms to the selected Pacific countries?',
    debt: 'Who has lent money to the selected Pacific countries?',
    fdi: 'Which overseas countries have the most direct business investment in the selected Pacific countries?',
    portfolio: 'Which countries have money invested in shares and bonds from the selected Pacific countries?',
  },
  influencerComparison: {
    aid: 'Where in the Pacific do the selected outside partners spend the most aid?',
    aid_committed: 'Where in the Pacific have the selected outside partners promised the most aid?',
    trade: 'Where in the Pacific do the selected outside partners sell the most goods?',
    exports: 'Where in the Pacific do the selected outside partners buy the most goods?',
    remittances: 'Where in the Pacific does money from people in the selected outside partners go?',
    migration: 'Which Pacific-born communities live in the selected outside partners?',
    students: 'Students from which Pacific countries study in the selected outside partners?',
    security: 'Where in the Pacific do the selected partners fund security assistance?',
    security_arms: 'Where in the Pacific do the selected suppliers send major conventional arms?',
    debt: 'Where in the Pacific have the selected outside partners lent money?',
    fdi: 'Where in the Pacific do the selected outside partners have direct business investment?',
    portfolio: 'Where in the Pacific do the selected outside partners have money invested in shares and bonds?',
  },
}

function formatCountryList(countries) {
  const names = countries.map(c => c.name)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function selectedInterpretation(metric, mode, countries = []) {
  const names = formatCountryList(countries)
  if (!names) return INTERPRETATION_COPY[mode]?.[metric]

  if (mode === 'pacific') {
    return {
      aid: `Who spends the most aid in ${names}?`,
      aid_committed: `Who has promised the most aid to ${names}?`,
      trade: `Who sells the most goods to ${names}?`,
      exports: `Who buys the most goods from ${names}?`,
      remittances: `Where does money sent home to ${names} come from?`,
      migration: `Where do people from ${names} live overseas?`,
      students: `Where do students from ${names} study overseas?`,
      security: `Who funds the most security assistance in ${names}?`,
      security_arms: `Who supplies major conventional arms to ${names}?`,
      debt: `Who has lent money to ${names}?`,
      fdi: `Which overseas countries have the most direct business investment in ${names}?`,
      portfolio: `Who has money invested in shares and bonds from ${names}?`,
    }[metric]
  }

  if (mode === 'influencer') {
    return {
      aid: `Where in the Pacific does ${names} spend the most aid?`,
      aid_committed: `Where in the Pacific has ${names} promised the most aid?`,
      trade: `Where in the Pacific does ${names} sell the most goods?`,
      exports: `Where in the Pacific does ${names} buy the most goods?`,
      remittances: `Where in the Pacific does money from people in ${names} go?`,
      migration: `Which Pacific-born communities live in ${names}?`,
      students: `Students from which Pacific countries study in ${names}?`,
      security: `Where in the Pacific does ${names} fund security assistance?`,
      security_arms: `Where in the Pacific does ${names} send major conventional arms?`,
      debt: `Where in the Pacific has ${names} lent money?`,
      fdi: `Where in the Pacific does ${names} have direct business investment?`,
      portfolio: `Where in the Pacific does ${names} have money invested in shares and bonds?`,
    }[metric]
  }

  if (mode === 'pacificComparison') {
    return {
      aid: `Who spends the most aid in ${names}?`,
      aid_committed: `Who has promised the most aid to ${names}?`,
      trade: `Who sells the most goods to ${names}?`,
      exports: `Who buys the most goods from ${names}?`,
      remittances: `Where does money sent home to ${names} come from?`,
      migration: `Where do people from ${names} live overseas?`,
      students: `Where do students from ${names} study overseas?`,
      security: `Who funds the most security assistance in ${names}?`,
      security_arms: `Who supplies major conventional arms to ${names}?`,
      debt: `Who has lent money to ${names}?`,
      fdi: `Which overseas countries have the most direct business investment in ${names}?`,
      portfolio: `Who has money invested in shares and bonds from ${names}?`,
    }[metric]
  }

  if (mode === 'influencerComparison') {
    return {
      aid: `Where in the Pacific do ${names} spend the most aid?`,
      aid_committed: `Where in the Pacific have ${names} promised the most aid?`,
      trade: `Where in the Pacific do ${names} sell the most goods?`,
      exports: `Where in the Pacific do ${names} buy the most goods?`,
      remittances: `Where in the Pacific does money from people in ${names} go?`,
      migration: `Which Pacific-born communities live in ${names}?`,
      students: `Students from which Pacific countries study in ${names}?`,
      security: `Where in the Pacific do ${names} fund security assistance?`,
      security_arms: `Where in the Pacific do ${names} send major conventional arms?`,
      debt: `Where in the Pacific have ${names} lent money?`,
      fdi: `Where in the Pacific do ${names} have direct business investment?`,
      portfolio: `Where in the Pacific do ${names} have money invested in shares and bonds?`,
    }[metric]
  }

  return INTERPRETATION_COPY[mode]?.[metric]
}

function InterpretationNote({ metric, mode, countries = [] }) {
  const text = selectedInterpretation(metric, mode, countries)
  if (!text) return null
  return <p className="interpretation-note">{text}</p>
}

function SelectionPills({ countries, onRemoveCountry, metric }) {
  if (!countries?.length) return null
  return <CountryChips countries={countries} onRemoveCountry={onRemoveCountry} metric={metric} />
}

function InfoIcon({ metric }) {
  const btnRef = useRef(null)
  const hideTimerRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const info = METRIC_INFO[metric]
  if (!info) return null
  const clearHideTimer = () => {
    if (!hideTimerRef.current) return
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = null
  }
  const showTooltip = () => {
    clearHideTimer()
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setPos({ left: rect.right + 8, top: rect.top - 4 })
    setVisible(true)
  }
  const hideTooltip = () => {
    if (pinned) return
    clearHideTimer()
    hideTimerRef.current = setTimeout(() => setVisible(false), 120)
  }
  const togglePinned = () => {
    if (pinned) {
      setPinned(false)
      setVisible(false)
      return
    }
    showTooltip()
    setPinned(true)
  }
  return (
    <span className="info-icon-wrap">
      <button
        ref={btnRef}
        className={`info-icon-btn ${pinned ? 'pinned' : ''}`}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onClick={togglePinned}
        aria-label="Data info"
      ><Info size={12} /></button>
      {visible && (
        <div
          className={`info-tooltip ${pinned ? 'pinned' : ''}`}
          style={{ left: pos.left, top: pos.top }}
          onMouseEnter={showTooltip}
          onMouseLeave={hideTooltip}
        >
          <div className="info-section">
            <span className="info-label">Source</span>
            <span>
              {info.sourceUrl && <a className="info-source-link" href={info.sourceUrl} target="_blank" rel="noreferrer">{info.source}</a>}
              {!info.sourceUrl && info.source}
              {info.sourceLinks && (
                <span className="info-inline-links">
                  {info.sourceLinks.map((link, i) => (
                    <a key={link.url} className="info-source-link" href={link.url} target="_blank" rel="noreferrer">
                      {link.text}{i < info.sourceLinks.length - 1 ? '; ' : ''}
                    </a>
                  ))}
                </span>
              )}
            </span>
          </div>
          <InfoSection label="Coverage" text={info.coverage} />
          <InfoSection label="Why this source" text={info.why} />
          <InfoSection label="What we did" text={info.changed} />
          <InfoSection label="Denominator" text={info.denominator} links={info.denominatorLinks} />
        </div>
      )}
    </span>
  )
}

function InfoSection({ label, text, links }) {
  if (!text) return null
  return (
    <div className="info-section">
      <span className="info-label">{label}</span>
      <span>
        <LinkedText text={text} links={links} />
      </span>
    </div>
  )
}

function LinkedText({ text, links }) {
  if (!links?.length) return text
  const linkMap = Object.fromEntries(links.map(link => [link.text, link]))
  const parts = text.split(/(\[[^\]]+\])/g)
  return parts.map((part, i) => {
    const label = part.match(/^\[([^\]]+)\]$/)?.[1]
    const link = label ? linkMap[label] : null
    if (!link) return part.replace(/^\[|\]$/g, '')
    return (
      <a key={`${link.url}-${i}`} className="info-source-link" href={link.url} target="_blank" rel="noreferrer">
        {label}
      </a>
    )
  })
}

function fmtValue(value, metric, bare = false) {
  if (value == null) return '-'
  if (metric === 'security_arms') {
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`
    return value.toFixed(value < 10 ? 2 : 1)
  }
  const prefix = bare || isPeopleMetric(metric) ? '' : '$'
  if (value >= 1e9) return `${prefix}${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `${prefix}${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `${prefix}${(value / 1e3).toFixed(1)}K`
  return `${prefix}${value.toFixed(1)}`
}

function fmtPct(pct, bare = false) {
  if (pct == null) return '-'
  return bare ? pct.toFixed(1) : `${pct.toFixed(1)}%`
}

function armsItemTitle(item) {
  return [
    item.name,
    item.numberOrdered ? `ordered: ${item.numberOrdered}` : null,
    item.deliveries ? `delivered units: ${item.deliveries}` : null,
    item.deliveryYears ? `delivery year(s): ${item.deliveryYears}` : null,
    item.orderYear ? `order year: ${item.orderYear}` : null,
    item.status ? `status: ${item.status}` : null,
    item.comments,
  ].filter(Boolean).join('\n')
}

function sortByValueThenPct(a, b) {
  const aPct = Number.isFinite(a.pct) ? a.pct : -Infinity
  const bPct = Number.isFinite(b.pct) ? b.pct : -Infinity
  const aValue = Number.isFinite(a.value) ? a.value : -Infinity
  const bValue = Number.isFinite(b.value) ? b.value : -Infinity
  return bValue - aValue || bPct - aPct
}

function metricTotal(rows) {
  return rows.reduce((sum, r) => sum + (Number.isFinite(r.pct) ? r.pct : 0), 0)
}

function metricValueTotal(rows) {
  return rows.reduce((sum, r) => sum + (Number.isFinite(r.value) ? r.value : 0), 0)
}

function armsDeliveriesTotal(rows) {
  return rows.reduce((sum, row) => {
    const items = row.securityBreakdown ?? []
    const delivered = items.reduce((itemSum, item) => {
      const value = Number(item.deliveries)
      return itemSum + (Number.isFinite(value) ? value : 0)
    }, 0)
    return sum + delivered
  }, 0)
}

function fmtArmsDeliveries(value) {
  return Number.isFinite(value) ? value.toFixed(value % 1 === 0 ? 0 : 1) : '-'
}

function metricLatestYear(rows) {
  return rows.reduce((latest, r) => Number.isFinite(r.year) ? Math.max(latest, r.year) : latest, 0) || null
}

function pctAggregate(rows) {
  let valueTotal = 0
  let denominatorTotal = 0
  for (const r of rows) {
    const pct = Number.isFinite(r.pct) ? r.pct : null
    const value = Number.isFinite(r.value) ? r.value : null
    if (!(pct > 0) || !(value > 0)) continue
    valueTotal += value
    denominatorTotal += value / (pct / 100)
  }
  return denominatorTotal > 0 ? (valueTotal / denominatorTotal) * 100 : null
}

function outflowShareRows(rows) {
  const totalValue = metricValueTotal(rows)
  return rows.map(row => ({
    ...row,
    pct: totalValue > 0 && Number.isFinite(row.value) ? (row.value / totalValue) * 100 : null,
    hs1Breakdown: row.hs1Breakdown?.map(item => ({
      ...item,
      pct: totalValue > 0 && Number.isFinite(item.value) ? (item.value / totalValue) * 100 : null,
    })),
    securityBreakdown: row.securityBreakdown?.map(item => ({
      ...item,
      pct: totalValue > 0 && Number.isFinite(item.value) ? (item.value / totalValue) * 100 : null,
    })),
  }))
}

function aggregateHs1Breakdown(rows) {
  const groups = new Map()
  rows.forEach(row => {
    row.hs1Breakdown?.forEach(item => {
      if (!groups.has(item.hs1Code)) {
        groups.set(item.hs1Code, {
          hs1Code: item.hs1Code,
          hs1Name: item.hs1Name,
          value: 0,
          pct: 0,
        })
      }
      const group = groups.get(item.hs1Code)
      group.value += Number.isFinite(item.value) ? item.value : 0
      group.pct += Number.isFinite(item.pct) ? item.pct : 0
    })
  })
  return [...groups.values()]
    .map(item => ({
      ...item,
      value: Math.round(item.value * 100) / 100,
      pct: item.pct ? Math.round(item.pct * 10000) / 10000 : null,
    }))
    .sort((a, b) => b.value - a.value)
}

function aggregateSecurityBreakdown(rows, metric) {
  const groups = new Map()
  rows.forEach(row => {
    row.securityBreakdown?.forEach((item, itemIndex) => {
      const key = metric === 'security_arms'
        ? `${item.code || item.name}-${item.deliveryYears || ''}-${itemIndex}`
        : `${item.code || item.name}`
      if (!groups.has(key)) {
        groups.set(key, {
          ...item,
          code: item.code || key,
          name: item.name || item.code || key,
          value: 0,
          pct: 0,
        })
      }
      const group = groups.get(key)
      group.value += Number.isFinite(item.value) ? item.value : 0
      group.pct += Number.isFinite(item.pct) ? item.pct : 0
    })
  })
  return [...groups.values()]
    .map(item => ({
      ...item,
      value: Math.round(item.value * 10000) / 10000,
      pct: item.pct ? Math.round(item.pct * 10000) / 10000 : null,
    }))
    .sort((a, b) => b.value - a.value)
}

function aggregatePacificMetric(dataIndex, metric) {
  const recipientRows = PACIFIC_LIST.map(pac => {
    const counterparts = Object.values(dataIndex[pac.code]?.[metric] ?? {})
    const value = counterparts.reduce((sum, r) => sum + (Number.isFinite(r.value) ? r.value : 0), 0)
    const pct = counterparts.reduce((sum, r) => sum + (Number.isFinite(r.pct) ? r.pct : 0), 0)
    const year = metricLatestYear(counterparts)
    return { value, pct, year }
  })
  return {
    pct: pctAggregate(recipientRows),
    value: metricValueTotal(recipientRows),
  }
}

function HeaderCell({ top, bottom, className = '', style }) {
  return (
    <span className={`table-header-cell ${className}`.trim()} style={style}>
      <span className="table-header-top">{top}</span>
      <span className="table-header-bottom">{bottom}</span>
    </span>
  )
}

function unitLabel(metric, kind) {
  if (kind === 'pctTotal') return '% total'
  if (metric === 'security_arms' && kind === 'exposure') return ''
  if (metric === 'security_arms' && kind === 'value') return 'units'
  if (kind === 'exposure') return isPeopleMetric(metric) ? '% pop' : '% GDP'
  if (kind === 'value') return isPeopleMetric(metric) ? 'people' : '$ USD'
  if (kind === 'year') return 'year'
  return ''
}

function TradeBreakdownRow({ row }) {
  const breakdown = row.hs1Breakdown ?? []
  if (!breakdown.length) return null

  return (
    <div className="trade-breakdown">
      {breakdown.slice(0, 10).map(item => (
        <div key={`${row.code}-${item.hs1Code}`} className="metric-row trade-breakdown-row">
          <span className="rank"></span>
          <span className="row-name trade-breakdown-name" title={item.hs1Name}>{item.hs1Name}</span>
          <span className="val-primary">{fmtValue(item.value, 'trade', true)}</span>
          <span className="val-secondary">{fmtPct(item.pct, true)}</span>
          <span className="year-tag"></span>
        </div>
      ))}
    </div>
  )
}

function SecurityBreakdownRow({ row, metric }) {
  const breakdown = row.securityBreakdown ?? []
  if (!breakdown.length) return null

  return (
    <div className="trade-breakdown security-breakdown">
      {breakdown.slice(0, 12).map((item, i) => (
        <div key={`${row.code}-${item.code}-${i}`} className="metric-row trade-breakdown-row">
          <span className="rank"></span>
          <span
            className="row-name trade-breakdown-name"
            title={metric === 'security_arms' ? armsItemTitle(item) : item.name}
          >
            {metric === 'security_arms'
              ? `${item.name}${item.deliveryYears ? ` (${item.deliveryYears})` : ''}`
              : item.name}
          </span>
          <span className="val-primary">{metric === 'security_arms' ? (item.deliveries || '') : fmtValue(item.value, metric, true)}</span>
          <span className="val-secondary">{metric === 'security_arms' ? fmtValue(item.value, metric, true) : fmtPct(item.pct, true)}</span>
          <span className="year-tag"></span>
        </div>
      ))}
    </div>
  )
}

function TradeComparisonBreakdownRow({ row, columns, isPacificComparison, metric }) {
  const groups = new Map()
  row.vals.forEach((val, i) => {
    val?.hs1Breakdown?.forEach(item => {
      if (!groups.has(item.hs1Code)) {
        groups.set(item.hs1Code, {
          hs1Code: item.hs1Code,
          hs1Name: item.hs1Name,
          vals: Array(row.vals.length).fill(null),
          sortValue: 0,
        })
      }
      const group = groups.get(item.hs1Code)
      group.vals[i] = item
      group.sortValue += isPacificComparison ? (item.pct ?? 0) : (item.value ?? 0)
    })
  })

  const breakdown = [...groups.values()].sort((a, b) => b.sortValue - a.sortValue)
  if (!breakdown.length) return null

  return (
    <div className="trade-breakdown">
      {breakdown.slice(0, 10).map(item => (
        <div key={`${row.code}-${item.hs1Code}`} className="metric-row trade-breakdown-row">
          <span className="rank"></span>
          <span className="row-name trade-breakdown-name" title={item.hs1Name}>{item.hs1Name}</span>
          {columns.map((column, i) => (
            <span key={column.key} className={column.className} style={column.style} title={column.title}>
              {item.vals[i]
                ? isPacificComparison
                  ? fmtPct(item.vals[i].pct, true)
                  : fmtValue(item.vals[i].value, metric, true)
                : '-'}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

function SecurityComparisonBreakdownRow({ row, columns, metric }) {
  const groups = new Map()
  row.vals.forEach((val, i) => {
    val?.securityBreakdown?.forEach((item, itemIndex) => {
      const key = `${item.code || item.name}-${metric === 'security_arms' ? item.deliveryYears || itemIndex : ''}`
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          name: metric === 'security_arms'
            ? `${item.name}${item.deliveryYears ? ` (${item.deliveryYears})` : ''}`
            : item.name,
          vals: Array(row.vals.length).fill(null),
          sortValue: 0,
        })
      }
      const group = groups.get(key)
      group.vals[i] = item
      group.sortValue += item.value ?? 0
    })
  })

  const breakdown = [...groups.values()].sort((a, b) => b.sortValue - a.sortValue)
  if (!breakdown.length) return null

  return (
    <div className="trade-breakdown security-breakdown">
      {breakdown.slice(0, 12).map(item => (
        <div key={`${row.code}-${item.key}`} className="metric-row trade-breakdown-row">
          <span className="rank"></span>
          <span className="row-name trade-breakdown-name" title={item.name}>{item.name}</span>
          {columns.map((column, i) => (
            <span key={column.key} className={column.className} style={column.style} title={column.title}>
              {item.vals[i]
                ? metric === 'security_arms'
                  ? fmtArmsDeliveries(Number(item.vals[i].deliveries))
                  : fmtValue(item.vals[i].value, metric, true)
                : '-'}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

function ExpandRowsButton({ expanded, hiddenCount, onClick }) {
  if (hiddenCount <= 0) return null
  return (
    // preventDefault on mousedown stops the button taking focus, which would make
    // the browser scroll it into view as the list grows — dragging the pinned
    // country pill up and out of the scroll area.
    <button
      className="metric-row metric-row-expand-control"
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
    >
      <span className="rank">
        {expanded ? <ChevronUp size={12} strokeWidth={2.2} /> : <ChevronDown size={12} strokeWidth={2.2} />}
      </span>
      <span className="row-name">{expanded ? 'Show top 10' : `Show ${hiddenCount} more`}</span>
      <span className="val-primary"></span>
      <span className="val-secondary"></span>
      <span className="year-tag"></span>
    </button>
  )
}

function MetricTableCard({
  metric,
  columns,
  rows,
  summaryLabel,
  summaryCells,
  limitRows = false,
  onRowClick,
  renderRowExtra,
}) {
  const [expandedRows, setExpandedRows] = useState(false)
  const visibleRows = !limitRows || expandedRows ? rows : rows.slice(0, DEFAULT_ROW_LIMIT)
  const hiddenCount = limitRows ? Math.max(0, rows.length - DEFAULT_ROW_LIMIT) : 0
  const metricClass = isAidMetric(metric) ? 'aid' : isTradeMetric(metric) ? 'trade' : metric

  return (
    <div className="metric-table-shell">
      <div className={`single-table-header metric-${metricClass}`}>
        <div className="metric-header-title-group">
          <span className="metric-header-label">{METRIC_LABELS[metric]}</span>
          <InfoIcon metric={metric} />
        </div>
        <div className="col-headers metric-card-headers metric-header-columns">
          <span className="col-country"></span>
          {columns.map(column => (
            <HeaderCell
              key={column.key}
              top={column.headerTop}
              bottom={column.headerBottom}
              className={column.className}
              style={column.style}
            />
          ))}
        </div>
      </div>
      <div className="metric-table-preview">
        <div className="metric-row metric-total-row">
          <span className="rank"></span>
          <span className="row-name metric-total-label">{summaryLabel}</span>
          {columns.map(column => (
            <span key={column.key} className={column.className} style={column.style} title={column.title}>
              {summaryCells[column.key] ?? ''}
            </span>
          ))}
        </div>
      </div>
      <div className="metric-rows single-table-rows">
        {rows.length === 0
          ? <div className="no-data-row">No data available</div>
          : visibleRows.map((row, i) => {
            const extra = renderRowExtra?.(row)
            return (
              <div key={row.key ?? row.code} className={`metric-row-stack ${extra ? 'expanded' : ''}`}>
                <div className={`metric-row ${row.expandable ? 'metric-row-expandable' : ''}`} onClick={() => onRowClick?.(row, i)}>
                  <span className="rank">{i + 1}</span>
                  <span className="row-name">{row.name}</span>
                  {columns.map(column => (
                    <span key={column.key} className={column.className} style={column.style} title={column.title}>
                      {row.cells[column.key] ?? '-'}
                    </span>
                  ))}
                </div>
                {extra}
              </div>
            )
          })
        }
        <ExpandRowsButton expanded={expandedRows} hiddenCount={hiddenCount} onClick={() => setExpandedRows(v => !v)} />
      </div>
    </div>
  )
}

function MetricTable({ metric, rows, totalPct, totalValue, totalLabel, onMetricCountryClick, pctLabel, limitRows = true, onAidModeChange, onTradeModeChange, onSecurityModeChange, onInvestmentModeChange }) {
  const [expandedDetail, setExpandedDetail] = useState(null)
  const columns = [
    {
      key: 'value',
      headerTop: metric === 'security_arms' ? 'units' : isPeopleMetric(metric) ? '' : '$',
      headerBottom: metric === 'security_arms' ? 'delivered' : isPeopleMetric(metric) ? 'people' : 'USD',
      className: 'val-primary',
    },
    {
      key: 'pct',
      headerTop: metric === 'security_arms' ? 'SIPRI' : '%',
      headerBottom: metric === 'security_arms' ? 'TIV' : pctLabel?.replace(/^%\s*/, '') || unitLabel(metric, 'exposure').replace(/^%\s*/, ''),
      className: 'val-secondary',
    },
    { key: 'year', headerTop: '', headerBottom: 'yr', className: 'year-tag' },
  ]
  const tableRows = rows.map((r, i) => ({
    ...r,
    key: `${r.code}-${r.year ?? i}`,
    expandable: (isTradeMetric(metric) && (r.hs1Breakdown?.length ?? 0) > 0) || (isSecurityMetric(metric) && (r.securityBreakdown?.length ?? 0) > 0),
    cells: {
      pct: metric === 'security_arms' ? fmtValue(r.value, metric, true) : fmtPct(r.pct, true),
      value: metric === 'security_arms' ? fmtArmsDeliveries(armsDeliveriesTotal([r])) : fmtValue(r.value, metric, true),
      year: r.yearLabel ?? (r.year ? `'${String(r.year).slice(2)}` : ''),
    },
  }))

  return (
    <>
      {isAidMetric(metric) && onAidModeChange && (
        <div className="metric-mode-toggle aid-mode-toggle" role="group" aria-label="Aid value type">
          {Object.entries(AID_MODE_LABELS).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`metric-mode-btn aid-mode-btn ${metric === mode ? 'active' : ''}`}
              onClick={() => onAidModeChange(mode)}
              aria-pressed={metric === mode}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {isTradeMetric(metric) && onTradeModeChange && (
        <div className="metric-mode-toggle trade-mode-toggle" role="group" aria-label="Trade direction">
          {Object.entries(TRADE_MODE_LABELS).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`metric-mode-btn trade-mode-btn ${metric === mode ? 'active' : ''}`}
              onClick={() => onTradeModeChange(mode)}
              aria-pressed={metric === mode}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {isSecurityMetric(metric) && onSecurityModeChange && (
        <div className="metric-mode-toggle security-mode-toggle" role="group" aria-label="Security view">
          {Object.entries(SECURITY_MODE_LABELS).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`metric-mode-btn security-mode-btn ${metric === mode ? 'active' : ''}`}
              onClick={() => onSecurityModeChange(mode)}
              aria-pressed={metric === mode}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {isInvestmentMetric(metric) && onInvestmentModeChange && (
        <div className="metric-mode-toggle investment-mode-toggle" role="group" aria-label="Investment view">
          {Object.entries(INVESTMENT_MODE_LABELS).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`metric-mode-btn investment-mode-btn ${metric === mode ? 'active' : ''}`}
              onClick={() => onInvestmentModeChange(mode)}
              aria-pressed={metric === mode}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <MetricTableCard
        metric={metric}
        columns={columns}
        rows={tableRows}
        summaryLabel={totalLabel}
        summaryCells={{
          pct: metric === 'security_arms' ? fmtValue(totalValue, metric, true) : fmtPct(totalPct, true),
          value: metric === 'security_arms' ? fmtArmsDeliveries(armsDeliveriesTotal(rows)) : fmtValue(totalValue, metric, true),
          year: '',
        }}
        limitRows={limitRows}
        onRowClick={(row) => {
          if (row.expandable) {
            setExpandedDetail(expandedDetail === row.key ? null : row.key)
            return
          }
          onMetricCountryClick(metric, row.code, row.name)
        }}
        renderRowExtra={(row) => {
          if (!row.expandable || expandedDetail !== row.key) return null
          if (isTradeMetric(metric)) return <TradeBreakdownRow row={row} />
          if (isSecurityMetric(metric)) return <SecurityBreakdownRow row={row} metric={metric} />
          return null
        }}
      />
    </>
  )
}

function YearControl({ selectedYear, yearMin, yearMax, playing, onYearChange, onPlayToggle, onYearReset }) {
  return (
    <div className="panel-time-control">
      <button className={`play-btn ${playing ? 'playing' : ''}`} onClick={onPlayToggle} aria-label={playing ? 'Pause year animation' : 'Play year animation'}>
        {playing ? <Pause size={12} strokeWidth={2.4} /> : <Play className="play-icon" size={12} strokeWidth={2.4} fill="currentColor" />}
      </button>
      <input
        type="range"
        min={yearMin}
        max={yearMax}
        value={selectedYear ?? yearMin}
        onChange={e => onYearChange(parseInt(e.target.value))}
        className="year-slider"
        aria-label="Year"
      />
      <span className="year-display">{selectedYear ?? 'Latest'}</span>
      {selectedYear && <button className="reset-btn" onClick={onYearReset} aria-label="Reset to latest">×</button>}
    </div>
  )
}

// Default view: one metric table ranked across Pacific recipients.
function PacificRankingView({ exposureScores, dataIndex, selectedMetric, onMetricCountryClick, selectedYear, onAidModeChange, onTradeModeChange, onSecurityModeChange, onInvestmentModeChange }) {
  const metric = selectedMetric
  const rows = PACIFIC_LIST
    .map(c => {
      const counterparts = Object.values(dataIndex[c.code]?.[metric] ?? {})
      const pct = exposureScores[c.code]?.metricScores?.[metric] ?? null
      const value = metricValueTotal(counterparts)
      const year = metricLatestYear(counterparts)
      const hs1Breakdown = isTradeMetric(metric) ? aggregateHs1Breakdown(counterparts) : null
      const securityBreakdown = isSecurityMetric(metric) ? aggregateSecurityBreakdown(counterparts, metric) : null
      return { code: c.code, name: c.name, pct, value, year, hs1Breakdown, securityBreakdown }
    })
    .filter(r => r.value > 0)
    .sort(sortByValueThenPct)
  const total = aggregatePacificMetric(dataIndex, metric)

  return (
    <>
      <div className="sections">
        <InterpretationNote metric={metric} mode="default" />
        <SelectionPills countries={[{ code: 'ALL_PACIFIC', name: 'All Pacific countries' }]} metric={selectedMetric} />
        <MetricTable
          metric={metric}
          rows={rows}
          totalPct={total.pct}
          totalValue={total.value}
          totalYear={selectedYear ?? null}
          totalLabel="Pacific total"
          onMetricCountryClick={onMetricCountryClick}
          isPacific={false}
          limitRows={false}
          onAidModeChange={onAidModeChange}
          onTradeModeChange={onTradeModeChange}
          onSecurityModeChange={onSecurityModeChange}
          onInvestmentModeChange={onInvestmentModeChange}
        />
      </div>
    </>
  )
}

// Single country view (Pacific recipient or one external influencer)
function SingleCountryView({ country, dataIndex, selectedMetric, onMetricCountryClick, selectedYear, onRemoveCountry, onAidModeChange, onTradeModeChange, onSecurityModeChange, onInvestmentModeChange }) {
  const { code, isPacific } = country

  function pacificMetricRows(metric) {
    const counterparts = dataIndex[code]?.[metric] ?? {}
    return Object.entries(counterparts)
      .map(([cpCode, d]) => ({
        code: cpCode,
        name: d.name,
        value: d.value,
        pct: d.pct,
        year: d.year,
        hs1Breakdown: d.hs1Breakdown,
        securityBreakdown: d.securityBreakdown,
      }))
      .filter(r => r.value > 0)
      .sort(sortByValueThenPct)
  }

  function influencerMetricRows(metric) {
    const rows = []
    for (const [pacCode, entry] of Object.entries(dataIndex)) {
      const cp = entry[metric]?.[code]
      if (!cp) continue
      rows.push({ code: pacCode, name: PAC_NAMES[pacCode] ?? pacCode, value: cp.value, pct: cp.pct, year: cp.year, hs1Breakdown: cp.hs1Breakdown, securityBreakdown: cp.securityBreakdown })
    }
    return rows
  }
  const baseRows = isPacific ? pacificMetricRows(selectedMetric) : influencerMetricRows(selectedMetric)
  const rows = isPacific ? baseRows : outflowShareRows(baseRows).sort(sortByValueThenPct)
  const totalPct = isPacific ? metricTotal(rows) : (rows.length ? 100 : null)
  const totalValue = metricValueTotal(rows)

return (
    <>
      <div className="sections sections-fixed-head">
        <InterpretationNote metric={selectedMetric} mode={isPacific ? 'pacific' : 'influencer'} countries={[country]} />
        <SelectionPills countries={[country]} onRemoveCountry={onRemoveCountry} metric={selectedMetric} />
        <MetricTable
          metric={selectedMetric}
          rows={rows}
          totalPct={totalPct}
          totalValue={totalValue}
          totalYear={selectedYear ?? null}
          totalLabel={isPacific ? 'Total value' : 'Pacific total'}
          onMetricCountryClick={onMetricCountryClick}
          isPacific={isPacific}
          pctLabel={isPacific ? undefined : '% of total'}
          limitRows={isPacific}
          onAidModeChange={onAidModeChange}
          onTradeModeChange={onTradeModeChange}
          onSecurityModeChange={onSecurityModeChange}
          onInvestmentModeChange={onInvestmentModeChange}
        />
      </div>
    </>
  )
}

// Multi-select comparison view
function ComparisonView({ countries, dataIndex, selectedMetric, onMetricCountryClick, onRemoveCountry, onAidModeChange, onTradeModeChange, onSecurityModeChange, onInvestmentModeChange }) {
  const isPacificComparison = countries.every(c => c.isPacific)
  return (
    <>
      <div className="sections">
        <InterpretationNote metric={selectedMetric} mode={isPacificComparison ? 'pacificComparison' : 'influencerComparison'} countries={countries} />
        <SelectionPills countries={countries} onRemoveCountry={onRemoveCountry} metric={selectedMetric} />
        <CompareMetricTable
          metric={selectedMetric}
          countries={countries}
          dataIndex={dataIndex}
          onMetricCountryClick={onMetricCountryClick}
          isPacificComparison={isPacificComparison}
          onAidModeChange={onAidModeChange}
          onTradeModeChange={onTradeModeChange}
          onSecurityModeChange={onSecurityModeChange}
          onInvestmentModeChange={onInvestmentModeChange}
        />
      </div>
    </>
  )
}

function CountryChips({ countries, onRemoveCountry, metric }) {
  return (
    <div className="comparison-chips">
      {countries.map((c, i) => {
        const color = selectionColor(metric, i)
        return (
        <span
          key={c.code}
          className={`comparison-chip${!onRemoveCountry || c.code === 'ALL_PACIFIC' ? ' no-remove' : ''}`}
          style={{ borderColor: color, color }}
        >
          <span className="comparison-chip-label">{c.name}</span>
          {onRemoveCountry && c.code !== 'ALL_PACIFIC' && (
            <button
              className="comparison-chip-remove"
              onClick={(e) => {
                e.stopPropagation()
                onRemoveCountry(c.code, c.name)
              }}
              aria-label={`Deselect ${c.name}`}
              title={`Deselect ${c.name}`}
            >
              <X size={11} strokeWidth={2.2} />
            </button>
          )}
        </span>
        )
      })}
    </div>
  )
}

function comparisonRowsForPacific(metric, countries, dataIndex) {
  const rowMap = new Map()
  for (const country of countries) {
    const topRows = Object.entries(dataIndex[country.code]?.[metric] ?? {})
      .map(([code, d]) => ({ code, name: d.name, pct: d.pct, value: d.value, year: d.year, securityBreakdown: d.securityBreakdown }))
      .filter(r => r.value > 0)
      .sort(sortByValueThenPct)
      .slice(0, DEFAULT_ROW_LIMIT)

    for (const row of topRows) {
      if (!rowMap.has(row.code)) rowMap.set(row.code, { code: row.code, name: row.name, vals: [] })
    }
  }

  return [...rowMap.values()]
    .map(row => ({
      ...row,
      vals: countries.map(c => {
        const d = dataIndex[c.code]?.[metric]?.[row.code]
        return d ? { pct: d.pct, value: d.value, year: d.year, hs1Breakdown: d.hs1Breakdown, securityBreakdown: d.securityBreakdown } : null
      }),
    }))
    .sort((a, b) => Math.max(...b.vals.map(v => v?.value ?? -Infinity)) - Math.max(...a.vals.map(v => v?.value ?? -Infinity)))
}

function comparisonRowsForExternal(metric, countries, dataIndex) {
  const rowMap = new Map()
  for (const country of countries) {
    const topRows = []
    for (const [pacCode, entry] of Object.entries(dataIndex)) {
      const d = entry[metric]?.[country.code]
      if (d) topRows.push({ code: pacCode, name: PAC_NAMES[pacCode] ?? pacCode, pct: d.pct, value: d.value, year: d.year, securityBreakdown: d.securityBreakdown })
    }
    topRows
      .filter(r => Number.isFinite(r.value))
      .sort((a, b) => b.value - a.value)
      .slice(0, DEFAULT_ROW_LIMIT)
      .forEach(row => {
        if (!rowMap.has(row.code)) rowMap.set(row.code, { code: row.code, name: row.name, vals: [] })
      })
  }

  return [...rowMap.values()]
    .map(row => ({
      ...row,
      vals: countries.map(c => {
        const d = dataIndex[row.code]?.[metric]?.[c.code]
        return d ? { pct: d.pct, value: d.value, year: d.year, hs1Breakdown: d.hs1Breakdown, securityBreakdown: d.securityBreakdown } : null
      }),
    }))
    .sort((a, b) => Math.max(...b.vals.map(v => v?.value ?? -Infinity)) - Math.max(...a.vals.map(v => v?.value ?? -Infinity)))
}

function CompareMetricTable({ metric, countries, dataIndex, onMetricCountryClick, isPacificComparison, onAidModeChange, onTradeModeChange, onSecurityModeChange, onInvestmentModeChange }) {
  const [expandedDetail, setExpandedDetail] = useState(null)
  const rows = isPacificComparison
    ? comparisonRowsForPacific(metric, countries, dataIndex)
    : comparisonRowsForExternal(metric, countries, dataIndex)
  const limitRows = isPacificComparison
  const comparisonKind = 'value'
  const comparisonUnit = unitLabel(metric, comparisonKind)
  const totalLabel = isPacificComparison ? 'Total value' : 'Pacific total'
  const comparisonCellClass = (i) => i < 2 ? 'comparison-val' : 'col-compare comparison-val'
  const columns = countries.map((country, i) => ({
    key: country.code,
    headerTop: country.code,
    headerBottom: comparisonUnit,
    className: comparisonCellClass(i),
    title: comparisonUnit,
  }))
  const cellValue = (v) => {
    if (!v) return '-'
    if (metric === 'security_arms') return fmtArmsDeliveries(armsDeliveriesTotal([v]))
    return fmtValue(v.value, metric, true)
  }
  const tableRows = rows.map(row => ({
    ...row,
    key: row.code,
    expandable: (isTradeMetric(metric) && row.vals.some(v => (v?.hs1Breakdown?.length ?? 0) > 0)) || (isSecurityMetric(metric) && row.vals.some(v => (v?.securityBreakdown?.length ?? 0) > 0)),
    cells: Object.fromEntries(countries.map((country, i) => [country.code, cellValue(row.vals[i])])),
  }))
  const summaryCells = Object.fromEntries(countries.map((country, i) => {
    if (!isPacificComparison) {
      const vals = Object.values(dataIndex)
        .map(entry => entry[metric]?.[country.code])
        .filter(Boolean)
      return [country.code, metric === 'security_arms' ? fmtArmsDeliveries(armsDeliveriesTotal(vals)) : fmtValue(metricValueTotal(vals), metric, true)]
    }

    const vals = rows.map(row => row.vals[i]).filter(Boolean)
    return [country.code, metric === 'security_arms' ? fmtArmsDeliveries(armsDeliveriesTotal(vals)) : fmtValue(metricValueTotal(vals), metric, true)]
  }))

  return (
    <>
      {isAidMetric(metric) && onAidModeChange && (
        <div className="metric-mode-toggle aid-mode-toggle" role="group" aria-label="Aid value type">
          {Object.entries(AID_MODE_LABELS).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`metric-mode-btn aid-mode-btn ${metric === mode ? 'active' : ''}`}
              onClick={() => onAidModeChange(mode)}
              aria-pressed={metric === mode}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {isTradeMetric(metric) && onTradeModeChange && (
        <div className="metric-mode-toggle trade-mode-toggle" role="group" aria-label="Trade direction">
          {Object.entries(TRADE_MODE_LABELS).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`metric-mode-btn trade-mode-btn ${metric === mode ? 'active' : ''}`}
              onClick={() => onTradeModeChange(mode)}
              aria-pressed={metric === mode}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {isSecurityMetric(metric) && onSecurityModeChange && (
        <div className="metric-mode-toggle security-mode-toggle" role="group" aria-label="Security view">
          {Object.entries(SECURITY_MODE_LABELS).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`metric-mode-btn security-mode-btn ${metric === mode ? 'active' : ''}`}
              onClick={() => onSecurityModeChange(mode)}
              aria-pressed={metric === mode}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {isInvestmentMetric(metric) && onInvestmentModeChange && (
        <div className="metric-mode-toggle investment-mode-toggle" role="group" aria-label="Investment view">
          {Object.entries(INVESTMENT_MODE_LABELS).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`metric-mode-btn investment-mode-btn ${metric === mode ? 'active' : ''}`}
              onClick={() => onInvestmentModeChange(mode)}
              aria-pressed={metric === mode}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <MetricTableCard
        metric={metric}
        columns={columns}
        rows={tableRows}
        summaryLabel={totalLabel}
        summaryCells={summaryCells}
        limitRows={limitRows}
        onRowClick={(row) => {
          if (row.expandable) {
            setExpandedDetail(expandedDetail === row.key ? null : row.key)
            return
          }
          onMetricCountryClick(metric, row.code, row.name)
        }}
        renderRowExtra={(row) => {
          if (!row.expandable || expandedDetail !== row.key) return null
          if (isTradeMetric(metric)) {
            return <TradeComparisonBreakdownRow row={row} columns={columns} isPacificComparison={isPacificComparison} metric={metric} />
          }
          if (isSecurityMetric(metric)) {
            return <SecurityComparisonBreakdownRow row={row} columns={columns} metric={metric} />
          }
          return null
        }}
      />
    </>
  )
}

export default function SidePanel({
  selectedCountries, dataIndex, exposureScores, activeMetrics,
  onAidModeChange,
  onTradeModeChange,
  onSecurityModeChange,
  onInvestmentModeChange,
  onCountryClick, onSelectMetric,
  onBackToIntro,
  selectedYear, yearMin, yearMax, playing, onYearChange, onPlayToggle, onYearReset,
}) {

  const isComparison = selectedCountries && selectedCountries.length > 1
  const isEmpty = !selectedCountries || selectedCountries.length === 0
  const selectedMetric = activeMetrics[0] ?? 'aid'

  const extraCols = Math.max(0, selectedCountries.length - 2)
  const tablesWidth = isComparison ? 310 + extraCols * 58 : 310

  // --- Mobile bottom-sheet: free drag ---
  // Starts collapsed showing the title, question and selected-country pill, but
  // NOT the table. The collapsed height is measured to the bottom of the pill so
  // it fits exactly. The user drags the handle to any height and it stays there
  // - no snapping, no auto-expand on selection.
  const isMobile = useIsMobile()
  const panelRef = useRef(null)
  const [sheetHeight, setSheetHeight] = useState(null)  // px, null until set
  const [collapsedH, setCollapsedH] = useState(null)    // measured pill-bottom
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef(null)
  const userDraggedRef = useRef(false)

  const minSheet = () => collapsedH ?? Math.round(window.innerHeight * SHEET_SNAPS.peek)
  const maxSheet = () => Math.round(window.innerHeight * SHEET_SNAPS.full)

  // Measure from the top of the sheet to the bottom of the pill, so collapsed
  // shows the pill but stops before the table. Re-measures when the selection or
  // metric changes (question length / pill text differ).
  useLayoutEffect(() => {
    if (!isMobile) return
    const panel = panelRef.current
    if (!panel) return
    const anchor = panel.querySelector('.comparison-chips') || panel.querySelector('.interpretation-note')
    if (!anchor) return
    const top = panel.getBoundingClientRect().top
    setCollapsedH(Math.ceil(anchor.getBoundingClientRect().bottom - top + 6))
  }, [isMobile, selectedCountries, selectedMetric, isEmpty, isComparison])

  // Until the user drags, keep the sheet pinned to the measured collapsed height.
  useEffect(() => {
    if (isMobile && collapsedH != null && !userDraggedRef.current) {
      setSheetHeight(collapsedH)
    }
  }, [isMobile, collapsedH])

  const onHandlePointerDown = e => {
    if (!isMobile) return
    e.currentTarget.setPointerCapture(e.pointerId)
    userDraggedRef.current = true
    dragRef.current = { startY: e.clientY, startH: sheetHeight ?? minSheet() }
    setDragging(true)
  }
  const onHandlePointerMove = e => {
    if (!dragRef.current) return
    const dy = dragRef.current.startY - e.clientY
    const h = Math.max(minSheet(), Math.min(maxSheet(), dragRef.current.startH + dy))
    setSheetHeight(h)
  }
  const onHandlePointerUp = () => {
    if (!dragRef.current) return
    dragRef.current = null
    setDragging(false)
  }
  const handleMetricCountryClick = (metric, code, name) => {
    onSelectMetric(metric)
    onCountryClick(code, name)
  }
  const handleRemoveCountry = (code, name) => {
    onCountryClick(code, name)
  }
  const yearControl = (
    <YearControl
      selectedYear={selectedYear}
      yearMin={yearMin}
      yearMax={yearMax}
      playing={playing}
      onYearChange={onYearChange}
      onPlayToggle={onPlayToggle}
      onYearReset={onYearReset}
    />
  )

  return (
    <div
      ref={panelRef}
      className={`side-panel${isMobile ? ` is-mobile${dragging ? ' dragging' : ''}` : ''}`}
      style={isMobile ? { height: sheetHeight ?? minSheet() } : undefined}
    >
      {isMobile && (
        <div
          className="sheet-handle"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        >
          <span className="sheet-grabber" />
        </div>
      )}
      {/* Left container: title and tables */}
      <div className="panel-tables" style={{ width: isMobile ? '100%' : tablesWidth }}>
        <div className="panel-titlebar">
          <button className="panel-back-btn" onClick={onBackToIntro} aria-label="Back to landing page">
            <ArrowLeft size={13} strokeWidth={2.2} />
          </button>
          <span className="panel-title">Pacific Links</span>
        </div>

        <div className="panel-content">
          {isEmpty ? (
            <PacificRankingView exposureScores={exposureScores} dataIndex={dataIndex} selectedMetric={selectedMetric} onMetricCountryClick={handleMetricCountryClick} onSelectMetric={onSelectMetric} yearControl={yearControl} selectedYear={selectedYear} onAidModeChange={onAidModeChange} onTradeModeChange={onTradeModeChange} onSecurityModeChange={onSecurityModeChange} onInvestmentModeChange={onInvestmentModeChange} />
          ) : isComparison ? (
            <ComparisonView countries={selectedCountries} dataIndex={dataIndex} selectedMetric={selectedMetric} onMetricCountryClick={handleMetricCountryClick} onSelectMetric={onSelectMetric} yearControl={yearControl} onRemoveCountry={handleRemoveCountry} onAidModeChange={onAidModeChange} onTradeModeChange={onTradeModeChange} onSecurityModeChange={onSecurityModeChange} onInvestmentModeChange={onInvestmentModeChange} />
          ) : (
            <SingleCountryView country={selectedCountries[0]} dataIndex={dataIndex} selectedMetric={selectedMetric} onMetricCountryClick={handleMetricCountryClick} onSelectMetric={onSelectMetric} yearControl={yearControl} selectedYear={selectedYear} onRemoveCountry={handleRemoveCountry} onAidModeChange={onAidModeChange} onTradeModeChange={onTradeModeChange} onSecurityModeChange={onSecurityModeChange} onInvestmentModeChange={onInvestmentModeChange} />
          )}
        </div>
      </div>
    </div>
  )
}
