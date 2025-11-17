(async ()=>{
  try{
    const res = await fetch('http://localhost:3000/api/auth/register',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({name:'T', email:'test123456789@example.com', password:'password123'})
    });
    console.log('STATUS', res.status);
    const text = await res.text();
    console.log(text);
  }catch(e){
    console.error('ERR', e);
  }
})();