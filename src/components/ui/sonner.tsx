import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-2 group-[.toaster]:border-black group-[.toaster]:shadow-3d",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-black group-[.toast]:text-white group-[.toast]:border-2 group-[.toast]:border-black",
          cancelButton:
            "group-[.toast]:bg-white group-[.toast]:text-black group-[.toast]:border-2 group-[.toast]:border-black",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
