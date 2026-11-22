import type { ReactNode } from "react";
import type { RegionId } from "./regions";
import { REGIONS } from "./regions";

type ShopProps = {
  isOn: (key: string) => boolean;
  changed: readonly RegionId[];
};

const printed = (text: string) => <span className="font-mono font-semibold">{text}</span>;

/** A name on the left and a plain figure on the right. */
function Row({ children, price }: { children: ReactNode; price?: string }) {
  return (
    <li className="flex justify-between gap-4 py-1">
      <span>{children}</span>
      {price && <span className="shrink-0 text-right">{price}</span>}
    </li>
  );
}

const rows = "divide-y divide-line border-y border-line";

function Search({ on }: { on: boolean }) {
  const results = [
    ["Quill pen, enchanted (needs a nap)", "$24"],
    ["Quill, goose, ordinary", "$4"],
    ["Quill, raven, shed", "$9"],
  ] as const;
  const ranked = on ? [results[2], results[1], results[0]] : results;
  return (
    <div className="space-y-2">
      <p className="border-b border-line pb-1 font-mono">&gt; quill</p>
      <ol className={rows}>
        {ranked.map(([name, price]) => (
          <Row key={name} price={price}>
            {name}
          </Row>
        ))}
      </ol>
    </div>
  );
}

function OrderNote({ on }: { on: boolean }) {
  return (
    <div className="space-y-1">
      {on && (
        <>
          <p className="text-xs text-fg-muted">summary, generated</p>
          <p className="font-semibold">
            Wrap quills apart from wax; leave the parcel with the raven until Tuesday.
          </p>
        </>
      )}
      <p className="text-fg-muted">
        Wrap the quills apart from the wax. Last time a feather came loose and I am sure it was not
        yours. The cat may keep the box. Away until Tuesday: leave it with the raven.
      </p>
    </div>
  );
}

function Checkout({ on }: { on: boolean }) {
  return on ? (
    <div className="space-y-1">
      <p>Deliver to the tower, top floor.</p>
      <p>Pay with the saved card ending 0042.</p>
      <p>2 items, $28.</p>
      <p>{printed("[ pay now ]")}</p>
    </div>
  ) : (
    <div className="space-y-1">
      <p>
        <span className="font-semibold">cart</span> · address · payment
      </p>
      <p>2 items, $28.</p>
      <p>{printed("[ next: address ]")}</p>
    </div>
  );
}

function Settings({ on }: { on: boolean }) {
  return (
    <ul className={rows}>
      <Row price="by raven">delivery</Row>
      <Row price="english">language</Row>
      {on && (
        <li className="flex justify-between gap-4 py-1">
          <span>colour scheme</span>
          <span>
            <span className="font-semibold">light</span> · dark
          </span>
        </li>
      )}
    </ul>
  );
}

function Export({ on }: { on: boolean }) {
  return on ? (
    <div className="space-y-1">
      <p>{printed("[ export csv ]")}</p>
      <p className="text-xs text-fg-muted">The old export, kept while customers move.</p>
    </div>
  ) : (
    <p className="text-xs text-fg-muted">The old export is gone.</p>
  );
}

const DRAWINGS = {
  search: Search,
  "order note": OrderNote,
  checkout: Checkout,
  settings: Settings,
  export: Export,
} satisfies Record<RegionId, (props: { on: boolean }) => ReactNode>;

/** The order page: five regions in a fixed order, each with its state in words. */
export function Shop({ isOn, changed }: ShopProps) {
  return (
    <div className="space-y-4">
      <p>
        <span className="font-semibold">Moth &amp; Ink</span>{" "}
        <span className="text-fg-muted">order 0042</span>
      </p>
      {REGIONS.map((region) => {
        const on = isOn(region.key);
        const Drawing = DRAWINGS[region.id];
        return (
          <section key={region.id} className="space-y-2">
            <h3 className="text-sm">
              <span className="font-semibold">{region.id}</span>{" "}
              <span className="text-fg-muted">{region.state(on)}</span>
              {changed.includes(region.id) && (
                <>
                  {" "}
                  <span className="text-fg-muted">· changed</span>
                </>
              )}
            </h3>
            <Drawing on={on} />
          </section>
        );
      })}
    </div>
  );
}
