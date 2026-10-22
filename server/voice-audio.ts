import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const exec = promisify(execFile)
export async function hasEncoder() { try { await exec('ffmpeg',['-version'],{timeout:5000}); return true } catch { return false } }
export interface AudioOptions { format:string; speed:number; pitch:number; volume:number; normalize:boolean; startPause:number; endPause:number; music?:string; musicVolume?:number }
export async function processAudio(bytes:Buffer, options:AudioOptions) {
  const dir=await mkdtemp(join(tmpdir(),'deepthi-voice-'))
  try {
    const input=join(dir,'input'); const output=join(dir,`output.${options.format}`)
    await writeFile(input,bytes)
    const factor=2**(options.pitch/12)
    const filters=['aresample=24000',`asetrate=${24000*factor}`,'aresample=24000']
    // Factor is bounded to 0.5–2, keeping each atempo stage in its supported range.
    filters.push(`atempo=${1/factor}`,`atempo=${options.speed}`,`volume=${options.volume}`)
    if(options.normalize) filters.push('loudnorm=I=-16:TP=-1.5:LRA=11')
    if(options.startPause) filters.push(`adelay=${options.startPause*1000}:all=1`)
    if(options.endPause) filters.push(`apad=pad_dur=${options.endPause}`)
    const codec=options.format==='mp3'?['-c:a','libmp3lame','-b:a','192k']:options.format==='m4a'?['-c:a','aac','-b:a','192k']:['-c:a','pcm_s16le']
    const args=['-hide_banner','-loglevel','error','-protocol_whitelist','file,pipe','-i',input]
    if(options.music) {
      if(options.music === 'ambient' || options.music === 'bright') {
        const hz=options.music==='ambient'?174:261
        args.push('-f','lavfi','-i',`aevalsrc=0.12*(sin(2*PI*${hz}*t)+0.07*sin(2*PI*${hz*1.5}*t)):s=24000`)
      } else { const music=join(dir,'music');await writeFile(music,Buffer.from(options.music,'base64'));args.push('-stream_loop','-1','-protocol_whitelist','file,pipe','-i',music) }
      args.push('-filter_complex',`[0:a]${filters.join(',')}[voice];[1:a]volume=${options.musicVolume ?? 0.15},afade=t=in:d=1[bed];[voice][bed]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[mix]`,'-map','[mix]')
    } else args.push('-af',filters.join(','))
    await exec('ffmpeg',[...args,...codec,'-y',output],{timeout:60000,maxBuffer:100000})
    return await readFile(output)
  } finally { await rm(dir,{recursive:true,force:true}) }
}
