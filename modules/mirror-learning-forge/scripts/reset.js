'use strict';
const path=require('path');
const {ForgeStore}=require('../storage/store');
const root=path.resolve(__dirname,'..');
const store=new ForgeStore(path.join(root,'storage','runtime'));
store.reset();
console.log('Mirror Learning Forge local runtime reset.');
