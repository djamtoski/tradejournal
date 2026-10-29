import { PageHeader } from "./page-header";

export function Placeholder({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 px-6 py-24 text-center">
        <h2 className="text-[17px]">{title} is next on the list</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </>
  );
}
