/*
 * Copyright 2024 Control Drift Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import BattleGlobe from '../../features/BattleGlobe';
import EventCard from '../../ui/EventCard';
import RichMarkdownEditor from '../../ui/RichMarkdownEditor';

export default function Step3Execute({
    getAdversaryControlRatio,
    simulationPayload,
    addProcedure,
    testResults,
    collapsedCards,
    setCollapsedCards,
    updateProcedure,
    removeProcedure,
    showNameErrors,
    setShowNameErrors,
    selectedTTPs,
    autoMapProcedureTTPs,
    mappingProcedureId,
    aiSettings,
    isAssessing,
    autoAssessSeverity,
    compressImage,
    addSimulationEvidence,
    simulationDetails,
    setExpandedImage
}) {
    const [isGlobeCollapsed, setIsGlobeCollapsed] = useState(false);

    return (
        <div className="animate-fade-in" style={{  display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'hidden', paddingRight: '10px', minHeight: 0  }}>

            {/* Horizontal Dashboard Widget */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', marginBottom: '15px', background: 'linear-gradient(180deg, rgba(5,7,10,0.8) 0%, rgba(10,12,18,0.9) 100%)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, transition: 'all 0.3s ease', minHeight: isGlobeCollapsed ? '46px' : '0' }}>
                
                {/* Floating pill toggle */}
                <button 
                    type="button" 
                    onClick={() => setIsGlobeCollapsed(prev => !prev)} 
                    className="btn hover-lift" 
                    style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', zIndex: 10, cursor: 'pointer' }}
                >
                    {isGlobeCollapsed ? <><ChevronDown size={14} /> Show Battle Globe</> : <><ChevronUp size={14} /> Hide Battle Globe</>}
                </button>

                {/* Collapsible area */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateRows: isGlobeCollapsed ? '0fr' : '1fr', 
                    transition: 'grid-template-rows 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), padding 0.6s cubic-bezier(0.4, 0, 0.2, 1)', 
                    opacity: isGlobeCollapsed ? 0 : 1, 
                    padding: isGlobeCollapsed ? '0px 20px' : '5px 20px 0px 20px' 
                }}>
                    <div style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px 0 15px 0' }}>
                            <BattleGlobe ratio={getAdversaryControlRatio()} />
                        </div>
                    </div>
                </div>
            </div>
            
             <div className="responsive-row" style={{ flex: 1, minHeight: 0 }}>
               <div style={{  flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0  }}>
                  <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', marginTop: '10px', minHeight: '32px'  }}>
                     <h3 style={{  margin: 0, color: 'var(--text-primary)'  }}>Design Reference</h3>
                  </div>
                  <div style={{  flex: 1, height: 0, overflowY: 'auto', paddingRight: '10px', fontSize: '0.9rem', paddingTop: '15px', marginTop: '-15px'  }}>
                     {simulationPayload ? (
                         <div className="glass-panel" style={{  padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px'  }}>
                             <RichMarkdownEditor value={simulationPayload} readOnly={true} />
                         </div>
                     ) : (
                         <div style={{  padding: '20px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px dashed var(--glass-border)', color: 'var(--text-muted)', borderRadius: '8px', fontSize: '0.9rem'  }}>
                             No design was created in Step 2.
                         </div>
                     )}
                  </div>
               </div>

               <div style={{  flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0  }}>
                 <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', marginTop: '10px', minHeight: '32px', paddingRight: '16px'  }}>
                    <h3 style={{  margin: 0, color: 'var(--text-primary)'  }}>Simulation Events</h3>
                    <button type="button" className="btn" onClick={() => addProcedure(null)} style={{  fontSize: '0.85rem', padding: '6px 12px', background: 'rgba(156, 39, 176, 0.2)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(156, 39, 176, 0.3)'  }}>+ Add Event</button>
                 </div>
                 <div style={{  flex: 1, height: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingRight: '10px', paddingTop: '15px', marginTop: '-15px'  }}>
                 
                 {testResults.length === 0 ? (
                     <div style={{  padding: '20px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px dashed var(--glass-border)', color: 'var(--text-muted)', borderRadius: '8px', fontSize: '0.9rem'  }}>
                         No events added yet. Click "+ Add Event" to begin logging your simulated attacks.
                     </div>
                 ) : (
                     testResults.map((proc, index) => {
                       return (
                           <EventCard 
                               key={proc.id}
                               proc={proc}
                               index={index}
                               totalCards={testResults.length}
                               isCollapsed={collapsedCards[proc.id]}
                               onToggleCollapse={() => setCollapsedCards(prev => ({ ...prev, [proc.id]: !prev[proc.id] }))}
                               updateProcedure={updateProcedure}
                               removeProcedure={removeProcedure}
                               showNameErrors={showNameErrors}
                               setShowNameErrors={setShowNameErrors}
                               selectedTTPs={selectedTTPs}
                               autoMapProcedureTTPs={autoMapProcedureTTPs}
                               mappingProcedureId={mappingProcedureId}
                               aiSettings={aiSettings}
                               isAssessing={isAssessing}
                               autoAssessSeverity={autoAssessSeverity}
                               compressImage={compressImage}
                               addSimulationEvidence={addSimulationEvidence}
                               simulationName={simulationDetails.name}
                               setExpandedImage={setExpandedImage}
                               isManual={false}
                           />
                       );
                   })
             )}
           </div>
         </div>
       </div>
          </div>
    );
}
