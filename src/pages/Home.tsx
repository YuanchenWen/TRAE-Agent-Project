import { AgentChatWindow } from '@/features/agent/components/AgentChatWindow'
import { useAgentChat } from '@/features/agent/hooks/useAgentChat'

export default function Home() {
  const agent = useAgentChat()

  return <AgentChatWindow {...agent} />
}
