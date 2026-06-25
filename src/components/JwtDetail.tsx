import { decodeJwt, formatJwtTimeClaim, isJwtDecodeError } from "../jwt/decode";

interface Props {
  /**
   * Raw JWT string to decode and display.
   */
  token: string;
}

/**
 * Renders decoded JWT header, payload, time-claim summary, and validation warnings.
 */
export function JwtDetail({ token }: Props) {
  const decoded = decodeJwt(token);

  if (isJwtDecodeError(decoded)) {
    return (
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-[14px] text-danger">{decoded.error}</p>
      </div>
    );
  }

  const timeClaims = [
    { key: "exp", label: "Expires" },
    { key: "nbf", label: "Not before" },
    { key: "iat", label: "Issued at" },
  ] as const;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-auto p-3">
      {decoded.warnings.length > 0 ? (
        <ul
          className="m-0 list-disc space-y-1 pl-5 text-[14px] text-danger"
          aria-label="JWT warnings"
        >
          {decoded.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <section aria-labelledby="jwt-time-claims-heading">
        <h3
          id="jwt-time-claims-heading"
          className="mb-1 text-[14px] font-medium text-text"
        >
          Time claims
        </h3>
        <dl className="m-0 space-y-1 text-[14px]">
          {timeClaims.map(({ key, label }) => {
            const formatted = formatJwtTimeClaim(decoded.payload[key]);
            return (
              <div key={key} className="grid grid-cols-[7rem_1fr] gap-2">
                <dt className="text-muted">{label}</dt>
                <dd className="m-0 text-text">{formatted ?? "—"}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section aria-labelledby="jwt-header-heading">
        <h3
          id="jwt-header-heading"
          className="mb-1 text-[14px] font-medium text-text"
        >
          Header
        </h3>
        <pre className="m-0 overflow-auto rounded-md bg-control p-3 text-[14px] text-text">
          {JSON.stringify(decoded.header, null, 2)}
        </pre>
      </section>

      <section aria-labelledby="jwt-payload-heading">
        <h3
          id="jwt-payload-heading"
          className="mb-1 text-[14px] font-medium text-text"
        >
          Payload
        </h3>
        <pre className="m-0 overflow-auto rounded-md bg-control p-3 text-[14px] text-text">
          {JSON.stringify(decoded.payload, null, 2)}
        </pre>
      </section>
    </div>
  );
}
