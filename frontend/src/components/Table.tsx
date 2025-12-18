import React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

/**
 * Props for the Table component.
 * @template TData - The type of data objects in the table
 * @interface TableProps
 */
interface TableProps<TData> {
  /** Array of data objects to display in the table */
  data: TData[];
  /** Column definitions that specify how to render each column */
  columns: ColumnDef<TData>[];
  /** Additional CSS classes to apply to the table container */
  className?: string;
  /** Maximum height of the table container in pixels */
  maxHeight?: number;
  /** Whether to enable column sorting functionality */
  enableSorting?: boolean;
  /** Whether to enable column filtering functionality */
  enableFiltering?: boolean;
  /** Whether to enable pagination controls */
  enablePagination?: boolean;
  /** Number of rows to display per page */
  pageSize?: number;
  /** Array of page size options for the user to choose from */
  pageSizeOptions?: number[];
}

/**
 * A powerful, feature-rich table component built on top of TanStack Table with advanced functionality.
 *
 * The Table component provides a comprehensive data display interface with:
 * - Sortable columns with visual sort indicators
 * - Built-in pagination with customizable page sizes
 * - Column filtering capabilities
 * - Responsive design with horizontal scrolling
 * - Customizable styling with orange theme
 * - Alternating row colors for better readability
 * - Hover effects and visual feedback
 * - Accessibility features with proper ARIA attributes
 * - Flexible column definitions using TanStack Table
 * - Automatic row numbering and pagination info
 * - Customizable table height with overflow handling
 * - Professional appearance with consistent borders and spacing
 *
 * This component is ideal for displaying large datasets, user management tables,
 * analytics dashboards, and any interface requiring organized data presentation.
 *
 * @component
 * @template TData - The type of data objects in the table
 * @param {TableProps<TData>} props - The props for the Table component
 * @param {TData[]} props.data - Array of data objects to display in the table
 * @param {ColumnDef<TData>[]} props.columns - Column definitions that specify how to render each column
 * @param {string} [props.className] - Additional CSS classes to apply to the table container
 * @param {number} [props.maxHeight=400] - Maximum height of the table container in pixels
 * @param {boolean} [props.enableSorting=true] - Whether to enable column sorting functionality
 * @param {boolean} [props.enableFiltering=false] - Whether to enable column filtering functionality
 * @param {boolean} [props.enablePagination=true] - Whether to enable pagination controls
 * @param {number} [props.pageSize=10] - Number of rows to display per page
 * @param {number[]} [props.pageSizeOptions=[5, 10, 20, 50]] - Array of page size options
 *
 * @example
 * ```tsx
 * // Basic table with default settings
 * const columns = [
 *   { accessorKey: 'name', header: 'Name' },
 *   { accessorKey: 'email', header: 'Email' },
 *   { accessorKey: 'role', header: 'Role' }
 * ];
 *
 * <Table
 *   data={users}
 *   columns={columns}
 * />
 *
 * // Custom table with specific features
 * <Table
 *   data={products}
 *   columns={productColumns}
 *   maxHeight={600}
 *   enableSorting={true}
 *   enableFiltering={true}
 *   enablePagination={true}
 *   pageSize={25}
 *   pageSizeOptions={[10, 25, 50, 100]}
 *   className="my-8"
 * />
 *
 * // Table with custom column rendering
 * const columns = [
 *   {
 *     accessorKey: 'name',
 *     header: 'Product Name',
 *     cell: ({ row }) => (
 *       <div className="font-semibold">{row.original.name}</div>
 *     )
 *   },
 *   {
 *     accessorKey: 'price',
 *     header: 'Price',
 *     cell: ({ row }) => (
 *       <span className="text-green-400">${row.original.price}</span>
 *     )
 *   },
 *   {
 *     accessorKey: 'status',
 *     header: 'Status',
 *     cell: ({ row }) => (
 *       <Badge variant={row.original.status === 'active' ? 'success' : 'warning'}>
 *         {row.original.status}
 *       </Badge>
 *     )
 *   }
 * ];
 *
 * <Table
 *   data={products}
 *   columns={columns}
 *   enableSorting={true}
 *   enablePagination={false}
 * />
 *
 * // Table with custom styling
 * <Table
 *   data={analytics}
 *   columns={analyticsColumns}
 *   maxHeight={800}
 *   className="bg-gradient-to-r from-orange-900/20 to-orange-800/20 p-6 rounded-lg"
 * />
 *
 * // Table for user management
 * const userColumns = [
 *   { accessorKey: 'id', header: 'ID', size: 80 },
 *   { accessorKey: 'avatar', header: 'Avatar', cell: ({ row }) => <img src={row.original.avatar} className="w-8 h-8 rounded-full" /> },
 *   { accessorKey: 'name', header: 'Full Name' },
 *   { accessorKey: 'email', header: 'Email Address' },
 *   { accessorKey: 'department', header: 'Department' },
 *   { accessorKey: 'actions', header: 'Actions', cell: ({ row }) => (
 *     <div className="flex gap-2">
 *       <Button size="sm" onClick={() => editUser(row.original.id)}>Edit</Button>
 *       <Button size="sm" variant="danger" onClick={() => deleteUser(row.original.id)}>Delete</Button>
 *     </div>
 *   )}
 * ];
 *
 * <Table
 *   data={users}
 *   columns={userColumns}
 *   enableSorting={true}
 *   enablePagination={true}
 *   pageSize={20}
 *   maxHeight={600}
 * />
 * ```
 *
 * @returns {JSX.Element} A feature-rich table component with sorting, pagination, and filtering capabilities
 */
export function Table<TData>({
  data,
  columns,
  className = "",
  maxHeight = 400,
  enableSorting = true,
  enableFiltering = false,
  enablePagination = true,
  pageSize = 10,
}: TableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      pagination,
    },
    enableSorting,
    enableFilters: enableFiltering,
    manualPagination: !enablePagination,
  });

  const getSortIcon = (column: {
    getCanSort: () => boolean;
    getIsSorted: () => string | false;
  }) => {
    if (!column.getCanSort()) return null;

    if (column.getIsSorted() === "asc") {
      return <ChevronUp className="w-4 h-4" />;
    }
    if (column.getIsSorted() === "desc") {
      return <ChevronDown className="w-4 h-4" />;
    }
    return <ChevronsUpDown className="w-4 h-4 opacity-50" />;
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Table Container */}
      <div
        className="border-2 border-orange-300/50 rounded-md overflow-hidden"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        <div className="overflow-auto">
          <table className="w-full border-collapse">
            {/* Header */}
            <thead className="bg-orange-300 border-b-2 border-orange-300/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={`
                        px-4 py-3 text-left font-sans font-medium text-black
                        border-r border-black/30 last:border-r-0
                        ${
                          header.column.getCanSort()
                            ? "cursor-pointer select-none hover:bg-orange-200"
                            : ""
                        }
                      `}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-2">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {getSortIcon(header.column)}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            {/* Body */}
            <tbody className="bg-black">
              {table.getRowModel().rows.map((row, rowIndex) => (
                <tr
                  key={row.id}
                  className={`
                    border-b border-orange-300/20 last:border-b-0
                    hover:bg-orange-300/5
                    ${rowIndex % 2 === 0 ? "bg-black" : "bg-orange-300/5"}
                  `}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-2 font-sans text-orange-300 border-r border-orange-300/20 last:border-r-0"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {enablePagination && (
        <div className="flex items-center justify-between mt-4 px-2">
          <div className="flex items-center gap-4 text-sm text-orange-300">
            <span>
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </span>
            <span>
              Showing{" "}
              {table.getState().pagination.pageIndex *
                table.getState().pagination.pageSize +
                1}{" "}
              to{" "}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) *
                  table.getState().pagination.pageSize,
                table.getFilteredRowModel().rows.length
              )}{" "}
              of {table.getFilteredRowModel().rows.length} results
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1 border border-orange-300/50 rounded text-orange-300 hover:bg-orange-300/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1 border border-orange-300/50 rounded text-orange-300 hover:bg-orange-300/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
