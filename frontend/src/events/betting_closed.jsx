export default function Betting_closed({ data }) {
    return (
        <div className="p-4 bg-red-500">
            <h2 className="text-lg font-semibold mb-2">betting_closed</h2>
            <pre className="text-xs md:text-sm whitespace-pre-wrap break-words">{JSON.stringify(data, null, 2)}</pre>
        </div>
    )
}


