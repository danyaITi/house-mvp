export type SelectionKey = string | number
export const SAME_KIND_SELECTION_MESSAGE='Можно одновременно выбирать только объекты одного вида. Сначала снимите текущее выделение.'

export function selectKey<T extends SelectionKey>(current: readonly T[],key:T,additive:boolean):T[]{
  if(!additive)return [key]
  return current.includes(key)?current.filter(item=>item!==key):[...current,key]
}

export function singleSelection<T extends SelectionKey>(keys:readonly T[]):T|null{
  return keys.length===1?keys[0]:null
}

export function selectSameKind<T extends SelectionKey,K>(current:readonly T[],key:T,additive:boolean,kindOf:(key:T)=>K|undefined):{keys:T[];accepted:boolean}{
  if(!additive)return {keys:[key],accepted:true}
  if(current.length&&kindOf(current[0])!==kindOf(key))return {keys:[...current],accepted:false}
  return {keys:selectKey(current,key,true),accepted:true}
}

export function canExtendSelection(activeKind:string|null,candidateKind:string):boolean{
  return activeKind===null||activeKind===candidateKind
}

export function openingClickTarget(altKey:boolean):'opening'|'wall'{
  return altKey?'wall':'opening'
}
