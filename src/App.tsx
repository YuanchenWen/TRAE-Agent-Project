import Home from '@/pages/Home'
import { AgentI18nProvider } from '@/features/agent/i18n'

export default function App() {
  return (
    <AgentI18nProvider>
      <Home />
    </AgentI18nProvider>
  )
}
