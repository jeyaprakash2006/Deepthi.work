export const VOICES = ['Zephyr','Puck','Charon','Kore','Fenrir','Leda','Orus','Aoede','Callirrhoe','Autonoe','Enceladus','Iapetus','Umbriel','Algieba','Despina','Erinome','Algenib','Rasalgethi','Laomedeia','Achernar','Alnilam','Schedar','Gacrux','Pulcherrima','Achird','Zubenelgenubi','Vindemiatrix','Sadachbia','Sadaltager','Sulafat']
export const LANGUAGES: Record<string,string> = {hy:'Armenian',ta:'தமிழ் · Tamil',en:'English',hi:'Hindi',te:'Telugu',ml:'Malayalam',kn:'Kannada',bn:'Bengali',gu:'Gujarati',mr:'Marathi',ar:'Arabic',fr:'French',de:'German',es:'Spanish',it:'Italian',ja:'Japanese',ko:'Korean',pt:'Portuguese',ru:'Russian',zh:'Chinese',id:'Indonesian'}
export const STYLES: Record<string,string> = {story:'Warm, cheerful storytelling with expressive natural pauses',calm:'Calm, clear and patient teacher',energetic:'Energetic, upbeat narration',neutral:'Natural, clear conversational narration',news:'Professional, measured news presenter',gentle:'Gentle, reassuring and soft spoken',dramatic:'Dramatic, expressive storytelling'}
export function scriptParts(text:string, dialogue:boolean) {
  if (!dialogue) return [{type:'text',text}]
  return text.split(/\n+/).filter(s=>s.trim()).map(line=>{
    const m=line.match(/^\s*([AB]):\s*(.+)$/)
    if(!m) throw new Error('Start each dialogue line with A: or B: followed by text.')
    return {type:'text',text:m[2],speaker:m[1]}
  })
}
export const VOICE_TYPES = ['Alien','Calm','Demonic','Excited','Expressive','Female','High-pitch','Low-pitch','Male','Mature','Older','Robotic','Serious','Smooth','Synthetic','Teen','Warm','Younger']
export function outputSegments(text:string, output:string) {
 const parts=output==='paragraphs'?text.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean):[text.trim()]
 if(!parts.length || parts.length>5) throw new Error('Use 1–5 paragraphs for separate audio files.')
 return parts
}
