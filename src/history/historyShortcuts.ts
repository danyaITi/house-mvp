export type HistoryShortcut='undo'|'redo'|null

export function historyShortcut(event:{ctrlKey:boolean;metaKey:boolean;altKey:boolean;shiftKey:boolean;code:string;key:string}):HistoryShortcut{
  if(!event.ctrlKey&&!event.metaKey&&!event.altKey)return null
  const code=event.code||`Key${event.key.toUpperCase()}`
  if(code==='KeyZ')return (event.ctrlKey||event.metaKey)&&event.shiftKey?'redo':'undo'
  if(code==='KeyY')return 'redo'
  return null
}
