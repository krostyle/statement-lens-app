import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <SignUp
        appearance={{
          variables: {
            colorPrimary: '#2563eb',
            colorBackground: '#ffffff',
            colorText: '#0f172a',
            colorTextSecondary: '#64748b',
            colorInputBackground: '#ffffff',
            colorInputText: '#0f172a',
            colorDanger: '#ef4444',
            borderRadius: '0.5rem',
            fontFamily: 'inherit',
            fontSize: '0.875rem',
          },
          elements: {
            card: 'shadow-sm border border-slate-200 rounded-xl',
            headerTitle: 'text-slate-900 font-bold',
            headerSubtitle: 'text-slate-500',
            formButtonPrimary:
              'bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium rounded-md shadow-none normal-case',
            formFieldInput:
              'border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-[#2563eb] focus:border-transparent',
            formFieldLabel: 'text-sm font-medium text-slate-700',
            footerActionLink: 'text-[#2563eb] hover:text-[#1d4ed8] font-medium',
            identityPreviewEditButton: 'text-[#2563eb]',
            dividerLine: 'bg-slate-200',
            dividerText: 'text-slate-400 text-xs',
          },
        }}
      />
    </div>
  );
}
