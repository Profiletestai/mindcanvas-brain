"use client";

// Portal page background — matches Figma design:
// base #050914 + three soft blue radial brand glows (no grid).
export default function BackgroundGrid() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 bg-[#050914]">
      {/* soft blue radial glows (Figma: 3 radial gradients, blur 64) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            "radial-gradient(62% 52% at 26% 18%, rgba(1,90,139,0.14) 0%, rgba(1,90,139,0) 60%)",
            "radial-gradient(62% 52% at 74% 30%, rgba(45,143,196,0.15) 0%, rgba(45,143,196,0) 60%)",
            "radial-gradient(52% 46% at 56% 82%, rgba(100,186,226,0.20) 0%, rgba(100,186,226,0) 60%)",
          ].join(","),
        }}
      />
    </div>
  );
}
