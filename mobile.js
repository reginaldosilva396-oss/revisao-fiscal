let installEvent;
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches;
const button=document.createElement('button');
button.textContent='Instalar no celular';button.hidden=standalone();
document.querySelector('header').append(button);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e;button.hidden=false;});
button.onclick=async()=>{
 if(installEvent){await installEvent.prompt();installEvent=null;}
 else alert('No Chrome, abra o menu ⋮ e procure Instalar aplicativo ou Adicionar à tela inicial. Se aparecer somente Criar atalho, feche e abra novamente esta página com internet para concluir a atualização.');
};
window.addEventListener('appinstalled',()=>button.hidden=true);
const help=document.createElement('p');help.className='note';help.textContent='No Samsung A55: abra no Chrome e use o menu ⋮ → Adicionar à tela inicial. Importe seu lote JSON em Conteúdo e backup. Use este celular como dispositivo principal e exporte um backup semanal. A instalação e o primeiro acesso precisam de internet.';document.querySelector('#data').prepend(help);
