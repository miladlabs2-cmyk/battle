export default function Bets_update({ data }) {
    return (
        <div className="p-4">
            <h2 className="text-lg font-semibold mb-2">bets_update</h2>
            <pre className="text-xs md:text-sm whitespace-pre-wrap break-words">{JSON.stringify(data, null, 2)}</pre>
        </div>
    )
}


