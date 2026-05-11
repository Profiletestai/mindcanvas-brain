export const FEATURES = [
  {
    title: "Secure & Private",
    description: "Your data is encrypted and always protected.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Data-Driven Insights",
    description: "Make smarter decisions with proven data.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M3 16l5-5 4 4 3-3 6 6" />
        <circle cx="8.5" cy="8.5" r="1.2" fill="#fff" stroke="none" />
      </svg>
    ),
  },
  {
    title: "Built for Growth",
    description: "Tools and insights to help you grow faster.",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polygon points="12,3 14.6,9.1 21,9.8 16.2,14.1 17.6,20.5 12,17.3 6.4,20.5 7.8,14.1 3,9.8 9.4,9.1" />
      </svg>
    ),
  },
];

export function MarketingPane() {
  return (
    <aside className="hidden lg:flex flex-col text-white">
      <h1
        className="font-extrabold tracking-tight text-white"
        style={{
          fontSize: "62px",
          lineHeight: "62px",
          letterSpacing: "-2px",
        }}
      >
        Make Growth
        <br />
        Predictable
      </h1>

      <p
        className="mt-8"
        style={{
          fontSize: "15px",
          lineHeight: "25.5px",
          color: "rgba(255,255,255,0.6)",
          maxWidth: "320px",
        }}
      >
        Join thousands of professionals using data-driven insights to grow with
        confidence.
      </p>

      <ul className="mt-10 space-y-5">
        {FEATURES.map((f) => (
          <li key={f.title} className="flex items-center gap-4">
            <span
              className="flex items-center justify-center"
              style={{
                width: "46px",
                height: "46px",
                borderRadius: "14px",
                background: "rgb(84,175,224)",
                border: "1px solid rgba(84,175,224,0.12)",
                boxShadow: "0px 4px 16px 0px rgba(0,0,0,0.2)",
              }}
            >
              {f.icon}
            </span>
            <div>
              <div
                className="font-bold text-white"
                style={{ fontSize: "14px", lineHeight: 1 }}
              >
                {f.title}
              </div>
              <div
                className="mt-1"
                style={{
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.5)",
                  lineHeight: "18.6px",
                }}
              >
                {f.description}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
