import LoginForm from "@/app/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="mb-1 text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Lubricentro Victoria
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Iniciá sesión para ver el catálogo centralizado de proveedores.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
