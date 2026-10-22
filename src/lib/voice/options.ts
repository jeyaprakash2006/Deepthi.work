export const VOICES = ['Zephyr','Puck','Charon','Kore','Fenrir','Leda','Orus','Aoede','Callirrhoe','Autonoe','Enceladus','Iapetus','Umbriel','Algieba','Despina','Erinome','Algenib','Rasalgethi','Laomedeia','Achernar','Alnilam','Schedar','Gacrux','Pulcherrima','Achird','Zubenelgenubi','Vindemiatrix','Sadachbia','Sadaltager','Sulafat']
export const LANGUAGES: Record<string,string> = {ta:'தமிழ் · Tamil',en:'English',hi:'Hindi',te:'Telugu',ml:'Malayalam',kn:'Kannada',bn:'Bengali',gu:'Gujarati',mr:'Marathi',ar:'Arabic',fr:'French',de:'German',es:'Spanish',it:'Italian',ja:'Japanese',ko:'Korean',pt:'Portuguese',ru:'Russian',zh:'Chinese',id:'Indonesian'}
export const STYLES: Record<string,string> = {story:'Warm, cheerful storytelling with expressive natural pauses',calm:'Calm, clear and patient teacher',energetic:'Energetic, upbeat narration',neutral:'Natural, clear conversational narration',news:'Professional, measured news presenter',gentle:'Gentle, reassuring and soft spoken',dramatic:'Dramatic, expressive storytelling'}
export function scriptParts(text:string, dialogue:boolean) {
  if (!dialogue) return [{type:'text',text}]
  return text.split(/\n+/).filter(s=>s.trim()).map(line=>{
    const m=line.match(/^\s*([AB]):\s*(.+)$/)
    if(!m) throw new Error('Start each dialogue line with A: or B: followed by text.')
    return {type:'text',text:m[2],speaker:m[1]}
  })
}
