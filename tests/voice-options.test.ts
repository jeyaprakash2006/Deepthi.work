import { expect, it } from 'vitest'
import { scriptParts } from '../src/lib/voice/options'
it('parses dialogue without reading speaker labels aloud',()=>{
 expect(scriptParts('A: வணக்கம்!\nB: Hello!',true)).toEqual([{type:'text',text:'வணக்கம்!',speaker:'A'},{type:'text',text:'Hello!',speaker:'B'}])
 expect(()=>scriptParts('Unlabelled line',true)).toThrow()
 expect(scriptParts('A: ordinary prose',false)).toEqual([{type:'text',text:'A: ordinary prose'}])
})
it('splits paragraph output and bounds batch size',async()=>{
 const {outputSegments}=await import('../src/lib/voice/options')
 expect(outputSegments('First\n\nSecond','paragraphs')).toEqual(['First','Second'])
 expect(outputSegments('First\nSecond','single')).toEqual(['First\nSecond'])
 expect(()=>outputSegments(Array(6).fill('text').join('\n\n'),'paragraphs')).toThrow()
})
