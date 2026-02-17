'use client';

type Option = { value: string; label: string };

// Backwards compatible:
// 1) Old: <Segmented a="Ton" b="Send" value="a" onChange={...} />
// 2) New: <Segmented value="ton" options={[...]} onChange={...} />
export function Segmented(props:
  | { a: string; b: string; value: 'a' | 'b'; onChange: (v: 'a' | 'b') => void }
  | { options: Option[]; value: string; onChange: (v: string) => void }
) {
  const options: Option[] =
    'options' in props
      ? props.options
      : [
          { value: 'a', label: props.a },
          { value: 'b', label: props.b }
        ];

  const value = props.value;
  const onChange = props.onChange as (v: string) => void;

  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
