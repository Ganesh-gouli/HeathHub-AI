const t=async(r,o)=>{const l=o.foods.length>0?`<ul style="color: #555;">${o.foods.map(e=>`<li>${e.name} - <strong>${e.calories} kcal</strong></li>`).join("")}</ul>`:'<p style="color: #777;">No foods logged today.</p>',a={to:r,subject:`Daily Health Report - ${o.date}`,text:`Here is your daily health report for ${o.date}.

Calories Consumed: ${o.intake} kcal
Calories Burned: ${o.burned} kcal
Net Calories: ${o.net} kcal

Foods Consumed:
${o.foods.map(e=>`- ${e.name} (${e.calories} kcal)`).join(`
`)}

Keep up the great work!`,html:`
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
                <h2 style="color: #2c3e50;">Daily Health Report</h2>
                <p style="color: #7f8c8d;">Date: ${o.date}</p>
                <hr style="border: 0; border-top: 1px solid #eee;" />
                <div style="margin: 20px 0;">
                    <p><strong>Calories Consumed:</strong> <span style="color: #27ae60;">${o.intake} kcal</span></p>
                    <p><strong>Calories Burned:</strong> <span style="color: #e67e22;">${o.burned} kcal</span></p>
                    <p><strong>Net Calories:</strong> <span style="color: #2980b9;">${o.net} kcal</span></p>
                </div>
                
                <h3 style="color: #2c3e50; margin-top: 30px;">Activity Summary</h3>
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px;">
                     <h4 style="margin-top: 0; color: #16a085;">Foods Consumed</h4>
                     ${l}
                </div>

                <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;" />
                <p style="font-size: 12px; color: #999;">Sent from Health Hub AI</p>
            </div>
        `};try{const e=await fetch("/api/send-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)});if(!e.ok){const n=await e.json();throw new Error(n.error||"Failed to send email")}return!0}catch(e){throw console.error("Error sending email:",e),e}};export{t as s};
