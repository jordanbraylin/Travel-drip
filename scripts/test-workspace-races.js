import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; };
const freshAccount = () => ({loading:false,trips:[],counts:{},records:{}});
const state = {session:{user:{id:'one'},access_token:'fixture'},accountData:freshAccount(),activeTripId:'trip-one',chatData:{selectedRoomId:''},profileMetadata:{}};
let pending = deferred(), rendered = 0;
const noop = () => {};
const context = vm.createContext({state,isFilePreview:false,$:()=>null,loadIncomingTripInvitations:noop,
  apiRequest:()=>pending.promise,sessionStorage:{setItem:noop,removeItem:noop},loadAccountModuleData:async()=>({moduleData:{},counts:{},records:{},moduleErrors:{}}),
  syncSavedTravelRecords:noop,renderActiveTripAccountData:noop,renderLiveAccountDashboard:noop,loadTripChatData:async()=>{},loadSavedReceiptTotals:async()=>{},loadWalletAccess:async()=>{},
  transportRecords:[],travelSmartSearchRecords:[],renderAccountState:()=>{rendered++;},renderProfileSummary:noop,
  loadMemoryFiles:async()=>{},loadTripDocuments:async()=>{},subscribeToLiveData:noop,refreshTripWeather:noop});
vm.runInContext(source.slice(source.indexOf('async function loadAccountData()'), source.indexOf('function getCorporateOperationsTripId()')),context);
let loading = vm.runInContext('loadAccountData()',context);
const oldAccount = state.accountData;
state.session = {user:{id:'two'},access_token:'other'};
state.accountData = freshAccount();
const newAccount = state.accountData;
pending.resolve({trips:[{id:'private-old-trip'}]});
await loading;
assert.equal(state.accountData,newAccount);
assert.deepEqual(newAccount.trips,[]);
assert.equal(oldAccount.loading,false);
assert.equal(rendered,0,'Old account response must not render after account switch');

state.session = {user:{id:'one'},access_token:'fixture'};
state.accountData = freshAccount();
state.activeTripId = 'trip-one';
pending = deferred();
loading = vm.runInContext('loadAccountData()',context);
pending.resolve({trips:[{id:'trip-one'}]});
await loading;
assert.equal(state.accountData.trips[0].id,'trip-one');
assert.equal(rendered,1);
pending = deferred();
context.apiRequest = async()=>{throw new Error('Fixture unavailable');};
await vm.runInContext('loadAccountData()',context);
assert.equal(state.accountData.error,'Fixture unavailable');
assert.equal(rendered,2,'A current-account error must still render');

const room = deferred(), requests=[];
state.accountData.activeTrip={title:'Trip one'};
state.activeTripId='trip-one';
context.apiRequest=async(path,options)=>{requests.push(JSON.parse(options.body));return room.promise;};
context.showWorkflowMessage=()=>{throw new Error('Stale chat must not update new trip');};
context.navigateSafely=noop;
vm.runInContext(source.slice(source.indexOf('async function createFirstTripChat('),source.indexOf('function initialsFromName(')),context);
const creating=vm.runInContext('createFirstTripChat("QA", "Private message")',context);
state.activeTripId='trip-two';
room.resolve({room:{id:'room-one'}});
assert.equal(await creating,false);
assert.equal(requests.length,1,'Never send the first message into a newly selected trip');
assert.equal(state.chatData.selectedRoomId,'');

const walletOne=deferred(),walletTwo=deferred();
let summaries=0;
context.sessionStorage.getItem=()=>state.activeTripId;
context.renderWalletAccess=noop;
context.syncWalletSummary=()=>{summaries++;};
state.ownershipTransfer={};
state.walletAccess={};
state.activeTripId='trip-one';
context.apiRequest=path=>path.includes('trip-one')?walletOne.promise:walletTwo.promise;
vm.runInContext(source.slice(source.indexOf('let walletAccessRequestId = 0;'),source.indexOf('function setOwnershipTransferMessage(')),context);
const firstWallet=vm.runInContext('loadWalletAccess()',context);
state.activeTripId='trip-two';
const secondWallet=vm.runInContext('loadWalletAccess()',context);
walletTwo.resolve({tripId:'trip-two',wallet:{availableCents:200}});
await secondWallet;
walletOne.resolve({tripId:'trip-one',wallet:{availableCents:100}});
await firstWallet;
assert.equal(state.activeTripId,'trip-two');
assert.equal(state.walletAccess.wallet.availableCents,200);
assert.equal(summaries,1,'An old wallet must not replace the selected trip balance');

const receipt=deferred();
const totals=[];
context.savedReceiptTotals=totals;
context.renderBillSplit=noop;
state.supabase={from:()=>{const query={select:()=>query,eq:()=>query,order:()=>query,limit:()=>receipt.promise};return query;}};
vm.runInContext(source.slice(source.indexOf('async function loadSavedReceiptTotals()'),source.indexOf('function getParticipantSplits(')),context);
const receipts=vm.runInContext('loadSavedReceiptTotals()',context);
state.activeTripId='another-trip';
receipt.resolve({data:[{id:'private-receipt',payload:{total:100}}]});
await receipts;
assert.equal(totals.length,0,'Stale receipts must never appear in another trip');

let submitHandler,reset=0,closed=0;
const submit={disabled:false};
const form={querySelector:()=>submit,reset:()=>{reset++;}};
const dialog={close:()=>{closed++;}};
const handlerContext=vm.createContext({$:selector=>selector==='#newMessageForm'?{addEventListener:(_event,handler)=>{submitHandler=handler;}}:selector==='#newMessageDialog'?dialog:{value:'QA'},createFirstTripChat:async()=>true});
const handlerStart=source.indexOf('  $("#newMessageForm")?.addEventListener');
const handlerEnd=source.indexOf('\n\n  $$("[data-memory-like]")',handlerStart);
vm.runInContext(source.slice(handlerStart,handlerEnd),handlerContext);
const event={preventDefault:noop,currentTarget:form};
const submitted=submitHandler(event);
event.currentTarget=null;
await submitted;
assert.equal(reset,1);
assert.equal(closed,1);
assert.equal(submit.disabled,false);

let path='/memories';const routeCalls=[];
const routing=vm.createContext({getInitialAuthMode:()=>path==='/login'?'signin':'',setAuthMode:noop,getTargetFromRoute:()=>path==='/memories'?'memoriesPanel':'dashboardHome',renderRoute:target=>{routeCalls.push(target);path='/login';},$:()=>({addEventListener:noop}),signOut:noop,enableNotifications:noop,sendAdminNotification:noop});
const routeStart=source.indexOf('  const initialAuthMode = getInitialAuthMode();', source.indexOf('window.addEventListener("popstate"'));
const routeEnd=source.indexOf('\n}\n\nfunction filterImportantInfo',routeStart);
vm.runInContext(source.slice(routeStart,routeEnd),routing);
assert.deepEqual(routeCalls,['memoriesPanel'],'Startup must not replace the remembered page with Home');
console.log('Workspace regression passed: stale account responses, current-account errors, chat/wallet/receipt isolation, async dialog close and startup route preservation.');
