import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

// ── Diagram definitions ────────────────────────────────────────────────────────

interface Diagram {
  id: string;
  title: string;
  tag: string;
  tagColor: string;
  summary: string;
  bullets: string[];
  chart: string;
}

const DIAGRAMS: Diagram[] = [
  {
    id: "cloud-run",
    title: "Cloud Run Serverless Architecture",
    tag: "Compute",
    tagColor: "bg-blue-100 text-blue-700",
    summary: "Fully managed, serverless containers with automatic scaling to zero.",
    bullets: [
      "Global Load Balancer routes to nearest region",
      "Cloud Armor handles DDoS & WAF rules",
      "Cloud Run scales 0 → N on demand",
      "Secret Manager holds API keys — no env vars in code",
    ],
    chart: `graph TD
    User([🌐 User]) --> GLB[Global Load Balancer]
    GLB --> Armor[Cloud Armor<br/>WAF / DDoS]
    Armor --> CR[Cloud Run Service<br/>Stateless Container]
    CR --> SM[(Secret Manager)]
    CR --> SQL[(Cloud SQL<br/>Private IP)]
    CR --> GCS[(Cloud Storage)]
    CR --> PubSub[Pub/Sub Topic]
    PubSub --> CRWorker[Cloud Run Job<br/>Background Worker]
    CRWorker --> BQ[(BigQuery)]`,
  },
  {
    id: "gke",
    title: "GKE Multi-Tier Application",
    tag: "Kubernetes",
    tagColor: "bg-indigo-100 text-indigo-700",
    summary: "Production GKE cluster with auto-scaling, Workload Identity, and private networking.",
    bullets: [
      "Autopilot mode — no node management",
      "Workload Identity binds K8s SA → IAM SA (no key files)",
      "Ingress → Services → Pods with HPA",
      "Memorystore Redis for session caching",
    ],
    chart: `graph TD
    Internet([🌐 Internet]) --> LB[Cloud Load Balancer<br/>SSL Termination]
    LB --> Ingress[GKE Ingress Controller]
    subgraph GKE_Cluster [GKE Autopilot Cluster]
      Ingress --> FE[Frontend Pods<br/>React / Next.js]
      Ingress --> API[API Pods<br/>Node / Python]
      FE --> API
      API --> Cache[Memorystore<br/>Redis]
      API --> DB[(Cloud SQL<br/>PostgreSQL)]
    end
    API -->|Workload Identity| IAM[IAM / Secret Manager]`,
  },
  {
    id: "iam",
    title: "GCP IAM & Resource Hierarchy",
    tag: "Security",
    tagColor: "bg-red-100 text-red-700",
    summary: "Org-wide IAM with least-privilege, Org Policies, and VPC Service Controls.",
    bullets: [
      "Org Policies enforced top-down (e.g. restrict public IPs)",
      "Folders group projects by environment or BU",
      "Service accounts per workload — no shared keys",
      "VPC SC perimeters protect sensitive APIs",
    ],
    chart: `graph TD
    Org[🏢 Organization<br/>example.com] --> FolderProd[Folder: Production]
    Org --> FolderDev[Folder: Development]
    Org --> FolderSec[Folder: Security]
    FolderProd --> ProjApp[Project: prod-app]
    FolderProd --> ProjData[Project: prod-data]
    FolderDev --> ProjDev[Project: dev-app]
    FolderSec --> ProjSec[Project: security-hub]
    ProjApp --> SA1[SA: app-runtime@]
    ProjData --> SA2[SA: data-pipeline@]
    ProjSec --> OrgPolicy[Org Policy<br/>Constraints]
    OrgPolicy --> Perimeter[VPC Service Controls<br/>Perimeter]`,
  },
  {
    id: "multiregion",
    title: "Multi-Region High Availability",
    tag: "Reliability",
    tagColor: "bg-green-100 text-green-700",
    summary: "Active-active multi-region setup with Cloud Spanner for global consistency.",
    bullets: [
      "Global Load Balancer with anycast IP",
      "Cloud Run in 2+ regions — failover in < 1s",
      "Cloud Spanner: 99.999% SLA, multi-region writes",
      "Cloud CDN caches static assets at the edge",
    ],
    chart: `graph LR
    User([🌐 User]) --> GLB[Global Anycast LB<br/>+ Cloud CDN]
    GLB --> US[us-central1<br/>Cloud Run]
    GLB --> EU[europe-west1<br/>Cloud Run]
    GLB --> APAC[asia-east1<br/>Cloud Run]
    US --> Spanner[(Cloud Spanner<br/>Multi-Region<br/>nam-eur-asia1)]
    EU --> Spanner
    APAC --> Spanner
    US --> GCS[(Cloud Storage<br/>Multi-Region)]
    EU --> GCS`,
  },
  {
    id: "data-pipeline",
    title: "Real-Time Data Pipeline",
    tag: "Analytics",
    tagColor: "bg-yellow-100 text-yellow-700",
    summary: "Streaming ingestion with Pub/Sub + Dataflow into BigQuery for analytics.",
    bullets: [
      "Pub/Sub decouples producers from consumers",
      "Dataflow (Apache Beam) for stateful stream processing",
      "BigQuery for real-time analytics at petabyte scale",
      "Looker Studio / Vertex AI for BI and ML",
    ],
    chart: `graph LR
    App([📱 Apps / IoT]) --> PubSub[Pub/Sub<br/>Ingestion Topic]
    API([🔗 REST APIs]) --> PubSub
    PubSub --> DF[Dataflow<br/>Streaming Pipeline]
    DF --> BQ[(BigQuery<br/>Analytics DW)]
    DF --> GCS[(Cloud Storage<br/>Raw Archive)]
    BQ --> Looker[Looker Studio<br/>Dashboards]
    BQ --> Vertex[Vertex AI<br/>ML Models]
    Vertex --> PubSub2[Pub/Sub<br/>Predictions]`,
  },
  {
    id: "security",
    title: "Defence-in-Depth Security",
    tag: "Security",
    tagColor: "bg-red-100 text-red-700",
    summary: "Layered security with Cloud Armor, VPC, BeyondCorp and SIEM integration.",
    bullets: [
      "Cloud Armor: L7 WAF, rate limiting, geo-blocking",
      "Private GKE / Cloud Run — no public IPs on workloads",
      "BeyondCorp IAP: zero-trust access to internal tools",
      "Security Command Center → Cloud Logging → SIEM",
    ],
    chart: `graph TD
    Internet([🌐 Internet]) --> Armor[Cloud Armor<br/>WAF · DDoS · Rate Limit]
    Armor --> HTTPS[HTTPS LB<br/>SSL/TLS Termination]
    HTTPS --> IAP[Identity-Aware Proxy<br/>BeyondCorp Zero Trust]
    IAP --> VPC
    subgraph VPC [Private VPC]
      App[Private Cloud Run<br/>/ GKE Nodes]
      App --> SM[(Secret Manager)]
      App --> DB[(Cloud SQL<br/>Private IP only)]
    end
    VPC --> SCC[Security Command Center]
    SCC --> SIEM[Cloud Logging<br/>→ SIEM Export]`,
  },
];

// ── Mermaid renderer ──────────────────────────────────────────────────────────

let mermaidReady = false;

function initMermaid() {
  if (mermaidReady) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      primaryColor: "#E8F0FE",
      primaryTextColor: "#202124",
      primaryBorderColor: "#4285F4",
      lineColor: "#5F6368",
      secondaryColor: "#F8F9FA",
      tertiaryColor: "#FEF7E0",
      fontFamily: "'Google Sans', 'Roboto', sans-serif",
      fontSize: "13px",
    },
    flowchart: { curve: "basis", padding: 16 },
  });
  mermaidReady = true;
}

let diagramCounter = 0;

function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`gcp-diag-${++diagramCounter}`);

  useEffect(() => {
    initMermaid();
    const el = containerRef.current;
    if (!el) return;

    el.innerHTML = "";
    mermaid
      .render(idRef.current, chart)
      .then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          // Make SVG responsive
          const svgEl = containerRef.current.querySelector("svg");
          if (svgEl) {
            svgEl.style.width = "100%";
            svgEl.style.height = "auto";
            svgEl.style.maxHeight = "340px";
          }
        }
      })
      .catch((err) => {
        console.error("Mermaid render error:", err);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<p class="text-xs text-red-500 p-2">Diagram render error</p>`;
        }
      });

    // Increment ID so next render of this diagram uses a fresh ID
    idRef.current = `gcp-diag-${++diagramCounter}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart]);

  return <div ref={containerRef} className="w-full" />;
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function GcpDiagramPanel() {
  const [selected, setSelected] = useState(DIAGRAMS[0].id);
  const diagram = DIAGRAMS.find((d) => d.id === selected) ?? DIAGRAMS[0];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-google-gray-border bg-white flex-shrink-0">
        <p className="text-xs font-semibold text-google-gray uppercase tracking-wide mb-2">
          GCP Architecture Diagrams
        </p>
        {/* Topic tabs — scrollable horizontal list */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {DIAGRAMS.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d.id)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all whitespace-nowrap ${
                selected === d.id
                  ? "bg-google-blue text-white border-google-blue"
                  : "border-google-gray-border text-google-gray hover:border-google-blue hover:text-google-blue"
              }`}
            >
              {d.title.split(" ").slice(0, 2).join(" ")}
            </button>
          ))}
        </div>
      </div>

      {/* Diagram + explanation — scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Diagram title + tag */}
        <div className="px-4 pt-4 pb-2 flex items-start gap-2">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[#202124] leading-tight">{diagram.title}</h3>
            <p className="text-xs text-google-gray mt-0.5">{diagram.summary}</p>
          </div>
          <span className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${diagram.tagColor}`}>
            {diagram.tag}
          </span>
        </div>

        {/* Mermaid diagram */}
        <div className="mx-3 mb-3 bg-white rounded-xl border border-google-gray-border overflow-hidden p-3">
          <MermaidDiagram key={diagram.id} chart={diagram.chart} />
        </div>

        {/* Key points */}
        <div className="mx-3 mb-4 bg-[#F8F9FA] rounded-xl border border-google-gray-border p-3">
          <p className="text-[10px] font-semibold text-google-gray uppercase tracking-wide mb-2">Key Points</p>
          <ul className="space-y-1.5">
            {diagram.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#202124]">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-google-blue/10 text-google-blue flex items-center justify-center text-[9px] font-bold mt-0.5">
                  {i + 1}
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Tip */}
        <div className="mx-3 mb-4 flex items-start gap-2 text-xs text-google-gray">
          <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-google-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Ask Arch to explain this architecture, discuss trade-offs, or adapt it to your use case.
        </div>
      </div>
    </div>
  );
}
