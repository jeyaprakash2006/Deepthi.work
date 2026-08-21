/** Routes the site: the workbench at "/", each tool on its own path. */
import { Home } from './components/Home'
import { Formatter } from './App'
import { ChemLab } from './ChemLab'
import { useRoute } from './lib/router'

export default function Shell() {
  const [path, go] = useRoute()

  if (path.startsWith('/tools/question-paper')) {
    return <Formatter onExit={() => go('/')} />
  }
  if (path.startsWith('/tools/chem-lab')) {
    return <ChemLab onExit={() => go('/')} />
  }
  return <Home onOpen={go} />
}
