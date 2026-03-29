export type AgentLocale = 'zh-CN' | 'en-US'

export const normalizeAgentLocale = (value: unknown): AgentLocale =>
  value === 'en-US' ? 'en-US' : 'zh-CN'

export const isEnglishLocale = (locale: AgentLocale): boolean => locale === 'en-US'

export const agentText = {
  defaultThreadTitle: (locale: AgentLocale): string =>
    isEnglishLocale(locale) ? 'Mail Agent' : '邮件助手',
  processedEmail: (locale: AgentLocale): string =>
    isEnglishLocale(locale)
      ? 'I processed the email based on your request.'
      : '我已经根据你的要求处理了这封邮件。',
  pendingPrompt: (locale: AgentLocale): string =>
    isEnglishLocale(locale)
      ? 'If this looks good, I can send it right away. If not, tell me what to change.'
      : '如果你确认没问题，我就直接帮你发送；如果还要改，继续告诉我。',
  continuePrompt: (locale: AgentLocale): string =>
    isEnglishLocale(locale)
      ? 'If you want to work on more emails, just tell me what you need.'
      : '如果你还要继续处理其他邮件，直接告诉我。',
  sendIntro: (locale: AgentLocale): string =>
    isEnglishLocale(locale) ? 'Okay, I will send this reply now.' : '好的，我来发送这封回复。',
  sendPrompt: (locale: AgentLocale): string =>
    isEnglishLocale(locale)
      ? 'If they reply, send it over and I can keep handling the thread.'
      : '如果对方回复了，随时告诉我，我可以继续帮你处理后续邮件。',
  holdIntro: (locale: AgentLocale): string =>
    isEnglishLocale(locale)
      ? 'I will hold this draft for now and not send it yet.'
      : '我先不发送，继续保留这版草稿。',
  holdDetail: (locale: AgentLocale): string =>
    isEnglishLocale(locale)
      ? 'Waiting for a clearer send or revise intent'
      : '等待更明确的发送或修改意图',
  holdPrompt: (locale: AgentLocale): string =>
    isEnglishLocale(locale)
      ? 'If you want me to send it, say “send it” or “go ahead”. If you want changes, tell me what to adjust.'
      : '如果你想直接发，告诉我“发吧”或“就这样发送”；如果要改，直接说你想怎么改。',
  reviseIntro: (locale: AgentLocale): string =>
    isEnglishLocale(locale)
      ? 'I revised the reply based on your request.'
      : '我已经按你的要求改了一版回复。',
  revisePrompt: (locale: AgentLocale): string =>
    isEnglishLocale(locale)
      ? 'If this version works, I can send it now. If not, tell me how to adjust it.'
      : '如果这版可以，我就直接帮你发送；如果还要改，继续告诉我想怎么调整。',
  searchSpecified: (locale: AgentLocale): string =>
    isEnglishLocale(locale) ? 'Search by the specified query' : '按指定条件搜索',
  searchLatestInbox: (locale: AgentLocale): string =>
    isEnglishLocale(locale) ? 'Check the latest inbox emails' : '查看最新收件箱邮件',
  searchSenderEmail: (locale: AgentLocale, value: string): string =>
    isEnglishLocale(locale)
      ? `Search by sender email ${value}`
      : `按发件邮箱 ${value} 搜索`,
  searchSender: (locale: AgentLocale, value: string): string =>
    isEnglishLocale(locale)
      ? `Search by sender ${value}`
      : `按发件人 ${value} 搜索`,
  searchSenderKeyword: (locale: AgentLocale, value: string): string =>
    isEnglishLocale(locale)
      ? `Search by name keyword ${value}`
      : `按姓名关键词 ${value} 搜索`,
  searchKeyword: (locale: AgentLocale, value: string): string =>
    isEnglishLocale(locale)
      ? `Search by keyword ${value}`
      : `按关键词 ${value} 搜索`,
  searchSubject: (locale: AgentLocale, value: string): string =>
    isEnglishLocale(locale)
      ? `Search by subject ${value}`
      : `按主题 ${value} 搜索`,
  searchPhrase: (locale: AgentLocale, value: string): string =>
    isEnglishLocale(locale)
      ? `Search by phrase ${value}`
      : `按短语 ${value} 搜索`,
  searchRequestKeywords: (locale: AgentLocale): string =>
    isEnglishLocale(locale)
      ? 'Search by keywords from the request'
      : '按请求中的关键词搜索',
  searchGeneric: (locale: AgentLocale): string =>
    isEnglishLocale(locale) ? 'Search by keywords' : '按关键词搜索',
  searchThen: (locale: AgentLocale): string =>
    isEnglishLocale(locale) ? ', then ' : '，然后',
  notFoundIntro: (locale: AgentLocale, detail?: string): string => {
    if (isEnglishLocale(locale)) {
      return detail
        ? `I first tried to ${detail.toLowerCase()}, but I still could not find an obvious matching email.`
        : 'I ran a search first, but I still could not find an obvious matching email.'
    }

    return detail
      ? `我先${detail}，但目前还没搜到明显匹配的邮件。`
      : '我先帮你搜了一轮，但目前还没搜到明显匹配的邮件。'
  },
  notFoundPrompt: (locale: AgentLocale): string =>
    isEnglishLocale(locale)
      ? 'You can give me the sender address, subject keywords, or roughly when you received it, and I will keep digging.'
      : '你可以继续给我发件邮箱、主题词，或者告诉我大概是什么时候收到的，我再往下搜。',
  foundSenderIntro: (locale: AgentLocale, sender: string): string =>
    isEnglishLocale(locale)
      ? `I found an email from ${sender}.`
      : `我来帮你查找 ${sender} 发给你的邮件。`,
  sendOrEditPrompt: (locale: AgentLocale): string =>
    isEnglishLocale(locale)
      ? 'Do you want me to send this reply now, or should I revise it first?'
      : '你希望我直接发送这封回复，还是需要修改内容？',
  plannerLanguageLabel: (locale: AgentLocale): string =>
    isEnglishLocale(locale) ? 'English' : 'Chinese',
}
