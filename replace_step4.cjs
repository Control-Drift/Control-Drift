const fs = require('fs');
const filePath = 'C:\\Users\\thoma\\.gemini\\antigravity\\scratch\\control-drift\\src\\components\\pages\\ExerciseWizard.jsx';
const content = fs.readFileSync(filePath, 'utf8');

const startIndex = content.indexOf('{step === 4 && (() => {');
const endIndex = content.indexOf('})()}', startIndex) + '})()}'.length;

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find step 4 block');
    process.exit(1);
}

const replacement = `{step === 4 && (
          <Step4Report
            testResults={testResults}
            selectedTTPs={selectedTTPs}
            getAggregatedScore={getAggregatedScore}
            activeSections={activeSections}
            setActiveSections={setActiveSections}
            reportData={reportData}
            setReportData={setReportData}
            simulationDetails={simulationDetails}
            compressImage={compressImage}
            addSimulationEvidence={addSimulationEvidence}
            simulationEvidence={simulationEvidence}
            isAiActive={isAiActive}
            generateAIReport={generateAIReport}
            isGeneratingReport={isGeneratingReport}
            setExpandedImage={setExpandedImage}
            removeSimulationEvidence={removeSimulationEvidence}
            updateProcedure={updateProcedure}
          />
        )}`;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync(filePath, newContent);
console.log('Successfully replaced Step 4.');
