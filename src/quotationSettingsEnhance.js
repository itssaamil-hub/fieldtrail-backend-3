const descriptions={
 'Company & branding':'Control the company identity, currency, quote numbering and support details shown on quotations.',
 'Packages':'Set the core packages your sales team can quote. Add clear features so customers understand what is included.',
 'Optional add-ons':'Manage optional extras that can be added to a quotation without changing the main package.',
 'Discount & payment rules':'Define discount limits, validity, advance payment and tax defaults used by the sales team.'
};

function enhanceQuotationSettings(){
 const panel=[...document.querySelectorAll('.ft-onboarding')].find(node=>node.querySelector('#ft-onboarding-title')?.textContent?.trim()==='Quotation settings');
 if(!panel)return;
 panel.classList.add('ft-q-settings-page');
 const root=panel.querySelector('.ft-q');
 const form=root?.querySelector('form');
 if(root)root.classList.add('ft-q-settings-shell');
 if(form)form.classList.add('ft-q-settings-form');
 panel.querySelectorAll('.ft-q h3').forEach((heading,index)=>{
   heading.classList.add('ft-q-settings-heading');
   const text=heading.textContent?.trim();
   if(descriptions[text]&&!heading.nextElementSibling?.classList.contains('ft-q-settings-description')){
     const p=document.createElement('p');
     p.className='ft-q-settings-description';
     p.textContent=descriptions[text];
     heading.insertAdjacentElement('afterend',p);
   }
   heading.dataset.section=String(index+1);
 });
}

const observer=new MutationObserver(()=>requestAnimationFrame(enhanceQuotationSettings));
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('load',enhanceQuotationSettings);
