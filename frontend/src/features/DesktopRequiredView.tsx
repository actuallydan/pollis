export default function DesktopRequiredView() {
    return (
         <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <div className="text-red-400 mb-2">Desktop Only</div>
          <div className="text-orange-300/70 text-sm">
            This app requires the desktop application.
          </div>
        </div>
      </div>
    )
}
