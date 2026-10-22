/** Routes the site: the workbench at "/", each tool on its own path. */
import { WordCraft, type CraftEditorId } from './WordCraft'
import { VoiceStudio } from './VoiceStudio'
import { ImageStudio } from './ImageStudio'
import { Home } from './components/Home'
import { Formatter } from './App'
import { ChemLab } from './ChemLab'
import { useRoute } from './lib/router'

export default function Shell() {
  const [path, go] = useRoute()

  const editor = (['wordcraft', 'gridcraft', 'deckcraft'] as CraftEditorId[])
    .find((id) => {
      const route = { wordcraft: 'docs', gridcraft: 'sheets', deckcraft: 'slides' }[id]
      return [id, route].some(slug => path === `/tools/${slug}` || path === `/tools/${slug}/`)
    })
  if (editor) {
    return <WordCraft editor={editor} onExit={() => go('/')} />
  }
  if (path.startsWith('/tools/image-studio') || path.startsWith('/tools/poster-maker')) {
    return <ImageStudio initialMode={path.includes('image-studio') ? 'image' : 'poster'} onExit={() => go('/')} />
  }
  if (path.startsWith('/tools/voice-studio')) return <VoiceStudio onExit={() => go('/')} />
  if (path.startsWith('/tools/question-paper')) {
    return <Formatter onExit={() => go('/')} />
  }
  if (path.startsWith('/tools/chem-lab')) {
    return <ChemLab onExit={() => go('/')} />
  }
  return <Home onOpen={go} />
}
