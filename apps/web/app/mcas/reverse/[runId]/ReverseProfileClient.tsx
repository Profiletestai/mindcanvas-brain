"use client";

import { useState } from "react";

export default function ReverseProfileClient(
  { runId, questions, title }:
  { runId:string, questions:any[], title?:string }
) {

  const [index,setIndex] = useState(0);
  const [answers,setAnswers] = useState<Record<string,string>>({});

  const q = questions[index];

  function answer(code:string) {

    const next = {...answers,[q.code]:code};

    setAnswers(next);

    if(index < questions.length-1){
      setIndex(index+1);
    }else{
      submit(next);
    }
  }

  async function submit(payload:any){

    await fetch(`/api/mcas/reverse/submit`,{
      method:"POST",
      headers:{ "Content-Type":"application/json"},
      body:JSON.stringify({runId,answers:payload})
    });

    window.location.href=`/mcas/reverse/${runId}/result`;
  }

  return (

    <div className="max-w-xl mx-auto py-16 text-white">

      <h1 className="text-xl mb-6">
        {title || "Reverse Profile Test"}
      </h1>

      <div className="bg-white/5 p-6 rounded-xl">

        <p className="mb-6">{q.prompt}</p>

        <div className="space-y-3">

          {q.options.map((o:any)=>(
            <button
              key={o.code}
              onClick={()=>answer(o.code)}
              className="block w-full text-left bg-white/5 p-3 rounded"
            >
              {o.label}
            </button>
          ))}

        </div>

      </div>

    </div>
  );
}