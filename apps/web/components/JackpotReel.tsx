"use client";
import { useEffect, useMemo, useState } from "react";
function easeOutCubic(t:number){ return 1 - Math.pow(1-t, 3); }

export function JackpotReel({ winningIndex, spinning, onDone }:{
  winningIndex:number|null; spinning:boolean; onDone?:()=>void;
}) {
  const [offset,setOffset] = useState(0);
  const seq = useMemo(() => {
    const out:number[] = [];
    // 15 items by default (placeholder tiles, no external assets).
    for (let r=0;r<12;r++) for (let i=1;i<=15;i++) out.push(i);
    return out;
  }, []);

  useEffect(() => {
    if (!spinning || !winningIndex) return;
    const itemW = 92;
    const centerX = 240;

    const startOffset = offset;
    const windowStart = seq.length - 30;
    let targetIdx = windowStart;
    for (let i=seq.length-1;i>=windowStart;i--){
      if (seq[i] === winningIndex) { targetIdx = i; break; }
    }
    const targetOffset = targetIdx*itemW - centerX;
    const delta = targetOffset - startOffset;
    const dur = 1800;
    const t0 = performance.now();
    let raf = 0;

    const step = (now:number) => {
      const t = Math.min(1, (now - t0)/dur);
      const e = easeOutCubic(t);
      setOffset(startOffset + delta*e);
      if (t < 1) raf = requestAnimationFrame(step);
      else onDone?.();
    };
    raf = requestAnimationFrame(step);
    return ()=>cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, winningIndex]);

  return (
    <div style={{position:"relative", overflow:"hidden", borderRadius:18, padding:"12px 0", background:"#fff", boxShadow:"0 12px 30px rgba(16,24,40,.10)"}}>
      <div style={{position:"absolute", top:0, bottom:0, left:"50%", width:3, background:"#2f7cf6", transform:"translateX(-50%)"}} />
      <div style={{display:"flex", gap:12, transform:`translateX(${-offset}px)`, padding:"0 14px"}}>
        {seq.map((n,idx)=>(
          <div
            key={idx}
            style={{
              width:80,
              height:80,
              borderRadius:16,
              background:"linear-gradient(135deg, #111827, #334155)",
              display:"flex",
              alignItems:"center",
              justifyContent:"center",
              color:"#fff",
              fontWeight:900,
              fontSize:18,
              letterSpacing:0.2
            }}
          >
            #{n}
          </div>
        ))}
      </div>
    </div>
  );
}
