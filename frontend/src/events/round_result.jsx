export default function Round_result({ data }) {
    return (
        <div className="p-4 bg-gray-500">
            <h2 className="text-lg font-semibold mb-2">round_result</h2>
            <pre className="text-xs md:text-sm whitespace-pre-wrap break-words">{JSON.stringify(data, null, 2)}</pre>
        </div>
    )
}


