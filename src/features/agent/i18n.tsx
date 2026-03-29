/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AgentLocale } from './types'

type TranslationKey =
  | 'thread.defaultTitle'
  | 'flash.gmailConnected'
  | 'flash.gmailAuthorizationFailed'
  | 'flash.backendUnavailable'
  | 'flash.agentSessionActivated'
  | 'flash.agentSessionActivatedFor'
  | 'flash.activateAgentSessionFailed'
  | 'assistant.welcome'
  | 'assistant.loadingPending'
  | 'assistant.loadingTask'
  | 'assistant.requestFailed'
  | 'ui.you'
  | 'ui.thoughtProcess'
  | 'ui.emailSummaryTitle'
  | 'ui.sender'
  | 'ui.subject'
  | 'ui.summary'
  | 'ui.noSummary'
  | 'ui.replyDraftIntro'
  | 'ui.replySentTitle'
  | 'ui.sentTo'
  | 'ui.senderAccount'
  | 'ui.connectGmailFirst'
  | 'ui.connectGmailDescription'
  | 'ui.connectGmail'
  | 'ui.checkingGmailSession'
  | 'ui.gmail'
  | 'ui.agentSession'
  | 'ui.imessageBridge'
  | 'ui.trigger'
  | 'ui.inactive'
  | 'ui.running'
  | 'ui.configured'
  | 'ui.disabled'
  | 'ui.unknown'
  | 'ui.imessageError'
  | 'ui.activateForIMessage'
  | 'ui.askInboxPlaceholder'
  | 'ui.connectPlaceholder'
  | 'ui.connectedAs'
  | 'ui.agentIdle'
  | 'ui.submit'
  | 'ui.language'
  | 'tool.searchEmails'
  | 'tool.readEmail'
  | 'tool.listAccountEmails'
  | 'tool.sendEmail'
  | 'tool.reviseDraft'
  | 'tool.awaitConfirmation'

type TranslationDictionary = Record<TranslationKey, string>

interface AgentI18nContextValue {
  locale: AgentLocale
  setLocale: (locale: AgentLocale) => void
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string
  localizeToolLabel: (label: string) => string
}

const STORAGE_KEY = 'agent-ui-locale'

const translations: Record<AgentLocale, TranslationDictionary> = {
  'zh-CN': {
    'thread.defaultTitle': '邮件助手',
    'flash.gmailConnected': 'Gmail 连接成功。',
    'flash.gmailAuthorizationFailed': 'Gmail 授权失败。',
    'flash.backendUnavailable': '后端暂时不可用，请确认 API 服务已启动。',
    'flash.agentSessionActivated': 'Agent session 已激活。',
    'flash.agentSessionActivatedFor': '已为 {email} 激活 Agent session。',
    'flash.activateAgentSessionFailed': '激活 Agent session 失败。',
    'assistant.welcome':
      '把邮件相关需求直接发给我，比如“查一下谁给我发了 team request，然后先起草一个回复”。我会按 agent 的方式帮你查找、阅读、总结、起草并在确认后发送。',
    'assistant.loadingPending': '正在处理你的确认或修改请求…',
    'assistant.loadingTask': '正在分析邮件任务并执行工具步骤…',
    'assistant.requestFailed': 'Agent 请求失败。',
    'ui.you': '你',
    'ui.thoughtProcess': '思考过程',
    'ui.emailSummaryTitle': '邮件内容已读取！以下是摘要：',
    'ui.sender': '发件人',
    'ui.subject': '主题',
    'ui.summary': '邮件内容摘要',
    'ui.noSummary': '暂无摘要',
    'ui.replyDraftIntro': '我已经帮你起草了一封回复，请确认是否满意，或者告诉我你想表达什么内容：',
    'ui.replySentTitle': '回复已成功发送！',
    'ui.sentTo': '发送至',
    'ui.senderAccount': '发件账号',
    'ui.connectGmailFirst': '先连接 Gmail',
    'ui.connectGmailDescription': '先连接 Gmail，然后你就可以直接说“帮我查某个人发来的邮件，再起草一封回复”。',
    'ui.connectGmail': '连接 Gmail',
    'ui.checkingGmailSession': '正在检查 Gmail 会话…',
    'ui.gmail': 'Gmail',
    'ui.agentSession': 'Agent Session',
    'ui.imessageBridge': 'iMessage 桥接',
    'ui.trigger': '触发词',
    'ui.inactive': '未激活',
    'ui.running': '运行中',
    'ui.configured': '已配置',
    'ui.disabled': '已禁用',
    'ui.unknown': '未知',
    'ui.imessageError': 'iMessage 错误',
    'ui.activateForIMessage': '激活到 iMessage',
    'ui.askInboxPlaceholder': '随便问我任何和邮箱相关的事情…',
    'ui.connectPlaceholder': '先连接 Gmail 再开始聊天…',
    'ui.connectedAs': '当前连接账号 {email}',
    'ui.agentIdle': 'Agent 空闲中',
    'ui.submit': '发送',
    'ui.language': '语言',
    'tool.searchEmails': '搜索邮件',
    'tool.readEmail': '读取邮件',
    'tool.listAccountEmails': '查看当前账号',
    'tool.sendEmail': '发送邮件',
    'tool.reviseDraft': '修改草稿',
    'tool.awaitConfirmation': '等待确认',
  },
  'en-US': {
    'thread.defaultTitle': 'Mail Agent',
    'flash.gmailConnected': 'Gmail connected successfully.',
    'flash.gmailAuthorizationFailed': 'Gmail authorization failed.',
    'flash.backendUnavailable': 'Backend is unavailable. Make sure the API server is running.',
    'flash.agentSessionActivated': 'Agent session activated.',
    'flash.agentSessionActivatedFor': 'Agent session activated for {email}.',
    'flash.activateAgentSessionFailed': 'Failed to activate agent session.',
    'assistant.welcome':
      'Send me any mail-related task, like “find who sent me the team request email and draft a reply first.” I will search, read, summarize, draft, and send after your confirmation.',
    'assistant.loadingPending': 'Handling your confirmation or revision request…',
    'assistant.loadingTask': 'Analyzing the mail task and running the required tools…',
    'assistant.requestFailed': 'Agent request failed.',
    'ui.you': 'You',
    'ui.thoughtProcess': 'Thought Process',
    'ui.emailSummaryTitle': 'Email loaded. Here is the summary:',
    'ui.sender': 'From',
    'ui.subject': 'Subject',
    'ui.summary': 'Summary',
    'ui.noSummary': 'No summary available',
    'ui.replyDraftIntro': 'I drafted a reply for you. Confirm if it looks good, or tell me what to change:',
    'ui.replySentTitle': 'Reply sent successfully!',
    'ui.sentTo': 'Sent to',
    'ui.senderAccount': 'Sender account',
    'ui.connectGmailFirst': 'Connect Gmail first',
    'ui.connectGmailDescription': 'Connect Gmail first, then you can ask things like “find who sent me this email and draft a reply.”',
    'ui.connectGmail': 'Connect Gmail',
    'ui.checkingGmailSession': 'Checking Gmail session...',
    'ui.gmail': 'Gmail',
    'ui.agentSession': 'Agent Session',
    'ui.imessageBridge': 'iMessage Bridge',
    'ui.trigger': 'Trigger',
    'ui.inactive': 'inactive',
    'ui.running': 'running',
    'ui.configured': 'configured',
    'ui.disabled': 'disabled',
    'ui.unknown': 'unknown',
    'ui.imessageError': 'iMessage Error',
    'ui.activateForIMessage': 'Activate For iMessage',
    'ui.askInboxPlaceholder': 'Ask AI anything about your inbox...',
    'ui.connectPlaceholder': 'Connect Gmail to start chatting...',
    'ui.connectedAs': 'Connected as {email}',
    'ui.agentIdle': 'Agent idle',
    'ui.submit': 'Submit',
    'ui.language': 'Language',
    'tool.searchEmails': 'Search Emails',
    'tool.readEmail': 'Read Email',
    'tool.listAccountEmails': 'List Account Emails',
    'tool.sendEmail': 'Send Email',
    'tool.reviseDraft': 'Revise Draft',
    'tool.awaitConfirmation': 'Await Confirmation',
  },
}

const toolLabelKeyMap: Record<string, TranslationKey> = {
  'Search Emails': 'tool.searchEmails',
  'Read Email': 'tool.readEmail',
  'List Account Emails': 'tool.listAccountEmails',
  'Send Email': 'tool.sendEmail',
  'Revise Draft': 'tool.reviseDraft',
  'Await Confirmation': 'tool.awaitConfirmation',
}

const AgentI18nContext = createContext<AgentI18nContextValue | null>(null)

const detectInitialLocale = (): AgentLocale => {
  const storedLocale = window.localStorage.getItem(STORAGE_KEY)

  if (storedLocale === 'zh-CN' || storedLocale === 'en-US') {
    return storedLocale
  }

  return window.navigator.language.toLowerCase().startsWith('zh')
    ? 'zh-CN'
    : 'en-US'
}

export function AgentI18nProvider({
  children,
}: {
  children: ReactNode
}) {
  const [locale, setLocaleState] = useState<AgentLocale>(detectInitialLocale)

  const setLocale = useCallback((nextLocale: AgentLocale) => {
    window.localStorage.setItem(STORAGE_KEY, nextLocale)
    setLocaleState(nextLocale)
  }, [])

  const t = useCallback(
    (key: TranslationKey, variables?: Record<string, string | number>) => {
      const template = translations[locale][key]

      if (!variables) {
        return template
      }

      return Object.entries(variables).reduce(
        (result, [name, value]) =>
          result.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value)),
        template,
      )
    },
    [locale],
  )

  const localizeToolLabel = useCallback(
    (label: string) => {
      const key = toolLabelKeyMap[label]
      return key ? t(key) : label
    },
    [t],
  )

  const contextValue = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      localizeToolLabel,
    }),
    [locale, localizeToolLabel, setLocale, t],
  )

  return (
    <AgentI18nContext.Provider value={contextValue}>
      {children}
    </AgentI18nContext.Provider>
  )
}

export function useAgentI18n(): AgentI18nContextValue {
  const contextValue = useContext(AgentI18nContext)

  if (!contextValue) {
    throw new Error('useAgentI18n must be used within AgentI18nProvider.')
  }

  return contextValue
}
