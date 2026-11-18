// Local multiplayer with 5-letter codes.
// How it works with no server (GitHub Pages is static): rooms live on a
// BroadcastChannel named by the code, so two+ copies of the game open on the
// same device / same browser (tabs or windows) join one world instantly.
// Host presses "Create Room" -> gets a 5-letter code -> friends open the game,
// press "Join Room", type the code. Positions, names, class and colours sync
// ~10x/sec. This is genuine local multiplayer for co-located play / LAN tabs.
const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ"; // no I/L/O to avoid confusion
export function makeCode(rng=Math.random){
  let c=""; for(let i=0;i<5;i++) c+=LETTERS[Math.floor(rng()*LETTERS.length)]; return c;
}
export class Room {
  constructor(onPeer, onChat){
    this.onPeer=onPeer; this.onChat=onChat; this.code=null; this.ch=null;
    this.peers=new Map(); this.id=Math.random().toString(36).slice(2,9);
  }
  host(){ this.code=makeCode(); this.open(); return this.code; }
  join(code){ this.code=(code||"").toUpperCase().trim(); if(this.code.length!==5) return false; this.open(); return true; }
  open(){
    if(!("BroadcastChannel" in window)) return;
    this.ch=new BroadcastChannel("aetheria-room-"+this.code);
    this.ch.onmessage=(e)=>{
      const m=e.data; if(!m || m.from===this.id) return;
      if(m.t==="state"){ this.peers.set(m.from,m); this.onPeer&&this.onPeer(m.from,m); }
      if(m.t==="bye"){ this.peers.delete(m.from); this.onPeer&&this.onPeer(m.from,null); }
      if(m.t==="chat"){ this.onChat&&this.onChat(m); }
    };
  }
  sendState(state){ if(this.ch) this.ch.postMessage({t:"state", from:this.id, ...state}); }
  sendChat(name, text){ if(this.ch) this.ch.postMessage({t:"chat", from:this.id, name, text}); }
  leave(){ if(this.ch){ try{this.ch.postMessage({t:"bye",from:this.id});}catch(e){} this.ch.close(); this.ch=null; } }
}
