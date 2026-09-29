import React, { useState, useEffect, useRef, useCallback } from 'react';
import { renderToString } from 'react-dom/server';
import * as Icons from 'lucide-react';
import { createLeadFeatures } from '../../src/lead/LeadFeatures.jsx';

const Stub = ({children}) => React.createElement('div', null, children);
const T = { ink:'#111', inkSoft:'#666', paper:'#eee', paperDeep:'#eee', card:'#fff', line:'#ddd', verified:'#080', verifiedSoft:'#efe', warn:'#a60', warnSoft:'#fff6dd', danger:'#b00', dangerSoft:'#fee', route:'#165c5d', accent:'#f60' };
const noop = () => {};
const api = new Proxy({}, { get: () => async () => ({}) });
const deps = {
  useState,useEffect,useRef,useCallback,api,ApiError:Error,T,inputStyle:{},
  STATUSES:['cold','conversation','hot','demo','negotiation','won','lost','nurture'],
  STATUS_LABEL:{cold:'Cold',conversation:'Conversation',hot:'Hot',demo:'Demo',negotiation:'Negotiation',won:'Won',lost:'Lost',nurture:'Nurture'},
  MONTH_NAMES:['January','February','March','April','May','June','July','August','September','October','November','December'],
  uuid:()=> '00000000-0000-4000-8000-000000000001', fmtMoney:String, fmtTime:()=>'', isToday:()=>true,isThisMonth:()=>true,isWithinDays:()=>false,isUpcomingRenewalMonth:()=>false,
  LeadBriefPopup:Stub,buildLeadBrief:()=>({}),leadAvatarStyle:()=>({}),leadInitials:()=>'',VerificationStamp:Stub,SyncBadge:Stub,Overlay:Stub,Select:Stub,Field:Stub,StatCard:Stub,SalesmanReportsPage:Stub,TasksEntry:Stub,
  getDeviceId:()=> 'device',getDayStarted:()=>true,setDayStartedFlag:noop,useSalesmanMessages:()=>({messages:[],markMessageRead:noop,deleteMessage:noop,replyToMessage:noop,employeeRepliesEnabled:true,setEmployeeRepliesEnabled:noop}),
  useSalesmanSettings:()=>({continuousTracking:false,allowLeadWithoutStartDay:false,attendanceLocationPolicy:{},dailyTarget:8,monthlyTarget:200}),useAttendanceGps:noop,useSalesmanLeads:()=>({leads:[],leadSummary:{},loading:false,loadingMore:false,queuedCount:0,totalLeadCount:0,hasMoreLeads:false,loadMoreLeads:noop,handleAddLead:noop,handleUpdateLeadStatus:noop,handleUpdateLeadDetails:noop}),useAttendanceDay:()=>({togglingDay:false,handleToggleDay:noop}),SalesmanView:Stub,DayClosingForm:Stub,
  Loader2:Icons.Loader2,AlertTriangle:Icons.AlertTriangle,WifiOff:Icons.WifiOff,Navigation:Icons.Navigation,Contact2:Icons.Contact2,Search:Icons.Search,List:Icons.List,Sparkles:Icons.Sparkles,Trash2:Icons.Trash2,PhoneIcon:Icons.Phone,WhatsAppIcon:Icons.MessageCircle,MessageSquare:Icons.MessageSquare,X:Icons.X,
};
const { AddLeadModal, LeadDetailDrawer } = createLeadFeatures(deps);
const session={id:'11111111-1111-4111-8111-111111111111',fullName:'Test Salesman',phone:'9999999999'};
renderToString(React.createElement(AddLeadModal,{session,online:true,onClose:noop,onSubmit:async()=>({ok:true,lead:{}}),onSaved:noop}));
const lead={id:'22222222-2222-4222-8222-222222222222',clientUuid:'c',salesmanId:session.id,salesmanName:session.fullName,business:'Smoke Cafe',subLocation:'Gomti Nagar',posName:'',renewalMonth:'',renewalDate:'',nextFollowUpDate:'',dealValue:15000,owner:'Owner',phone:'9999999999',category:'Cafe',status:'cold',hasLocation:true,lat:26.8,lng:80.9,accuracy:15,verification:'verified',createdAt:new Date(),updatedAt:new Date(),notes:'',syncStatus:'synced'};
renderToString(React.createElement(LeadDetailDrawer,{lead,onClose:noop,onStatusChange:noop,onUpdate:async()=>{},fetchHistory:async()=>({history:[]})}));
console.log('lead UI smoke render passed');
