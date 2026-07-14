import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  compact?: boolean;
  dark?: boolean;
  className?: string;
  subtitle?: string;
};

export default function BrandLogo({
  href = "/",
  compact = false,
  dark = false,
  className = "",
  subtitle = "SHIGUANG",
}: BrandLogoProps) {
  const content = (
    <>
      <svg
        className="brand-logo-symbol"
        viewBox="0 0 96 96"
        role="img"
        aria-label="拾光标志：相册、时间与一束光"
      >
        <path
          className="brand-clock"
          d="M16 47C17.6 27.5 30.6 14 48 14c17.7 0 30.8 13.7 32 33"
          fill="none"
          stroke="currentColor"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        <path className="brand-tick" d="M48 14v8M25 22l5 6M71 22l-5 6M16 47h8M80 47h-8" />
        <path
          className="brand-page brand-page-left"
          d="M14 50c13-2 24 1 34 10v25C38 75 27 72 14 74V50Z"
        />
        <path
          className="brand-page brand-page-right"
          d="M82 50c-13-2-24 1-34 10v25c10-10 21-13 34-11V50Z"
        />
        <path
          className="brand-hidden-s"
          d="M65 49c-9-4-18 0-20 7-2 7 6 9 12 10 8 1 10 6 4 10-5 4-13 4-20 1"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path className="brand-light" d="M48 24 40 56h16L48 24Z" />
        <path className="brand-page-line" d="M19 66c10 0 19 3 27 10M77 66c-10 0-19 3-27 10" />
      </svg>
      {!compact ? (
        <span className="brand-logo-copy">
          <strong>拾光</strong>
          <small>{subtitle}</small>
        </span>
      ) : null}
    </>
  );

  const classes = `brand-logo ${dark ? "brand-logo-dark" : ""} ${compact ? "brand-logo-compact" : ""} ${className}`.trim();
  return href ? (
    <Link className={classes} href={href}>
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  );
}
