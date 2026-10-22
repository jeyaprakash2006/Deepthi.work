import { expect, it } from 'vitest'
import { scriptParts } from '../src/lib/voice/options'
it('parses dialogue without reading speaker labels aloud',()=>{
 expect(scriptParts('A: வணக்கம்!\nB: Hello!',true)).toEqual([{type:'text',text:'வணக்கம்!',speaker:'A'},{type:'text',text:'Hello!',speaker:'B'}])
 expect(()=>scriptParts('Unlabelled line',true)).toThrow()
 expect(scriptParts('A: ordinary prose',false)).toEqual([{type:'text',text:'A: ordinary prose'}])
})
