import { expect, it } from 'vitest'
import { hasEncoder, processAudio } from '../server/voice-audio'
it('produces real WAV, MP3 and M4A containers with audio processing',async context=>{
 if(!await hasEncoder()) return context.skip()
 const pcm=Buffer.alloc(24000*2);const header=Buffer.alloc(44)
 header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40)
 for(let i=0;i<24000;i++)pcm.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/24000)*8000),i*2)
 const source=Buffer.concat([header,pcm])
 for(const format of ['wav','mp3','m4a']){
  const result=await processAudio(source,{format,speed:1.2,pitch:2,volume:0.8,normalize:false,startPause:0.5,endPause:0.5})
  expect(result.length).toBeGreaterThan(100)
  if(format==='wav')expect(result.toString('ascii',0,4)).toBe('RIFF')
  if(format==='m4a')expect(result.toString('ascii',4,8)).toBe('ftyp')
  if(format==='mp3')expect(result.toString('ascii',0,3)).toBe('ID3')
 }
})
